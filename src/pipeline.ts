// 리플레이 한 장을 홈페이지와 같은 절차로 등록한다 — 파싱(screp-js) → 회원 매칭 →
// 알려진 컴퓨터/비회원 이름 자동 분류 → 회원 수 확인 → 중복이면 머지, 아니면 등록.
// 홈페이지의 src/utils/replayDraft.ts와 같은 순서·같은 필드지만, 검토 모달이 사람에게 묻던
// 것은 전부 config.ts의 고정 규칙으로 정한다(승자 없음 → 결과 모름, 미매칭 → 비회원).
//
// replayDraft.ts를 그대로 import하지 못하는 이유: 그 파일은 브라우저 API 클라이언트
// (localStorage·리프레시 회전)를 끌어들인다. 파서·매칭·슬롯 규약은 그대로 가져다 쓴다.
// ⚠ 그래서 이 파일은 replayDraft.ts의 **사본**이다 — 홈페이지 쪽 절차가 바뀌면 여기도 맞춘다
//   (web/SOURCE의 커밋과 견주어 본다).
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseReplayFile, ReplayParseError } from "../web/src/utils/replayParser";
import type { ParsedReplayPlayer } from "../web/src/utils/replayParser";
import { matchReplayPlayerToMember } from "../web/src/utils/replayMemberMatch";
import { isComputerSlot, newComputerSlotId } from "../web/src/constants/computerSlot";
import { isUnregisteredSlot, newUnregisteredSlotId } from "../web/src/constants/unregisteredSlot";
import type { GameOutcome, GameResultSlot, Member, NewGameResult, ReplayUpload } from "../web/src/types";
import type { MergeReplayPayload, UploaderApi } from "./api";
import { REJECTED_GAME_TYPES, RULES } from "./config";

export type Outcome =
  | { kind: "registered"; matchNo: string; summary: string }
  | { kind: "merged"; summary: string }
  | { kind: "duplicate"; summary: string }
  | { kind: "skipped"; reason: string; summary: string };

function slotOf(p: ParsedReplayPlayer, memberId: string): GameResultSlot {
  return {
    memberId, race: p.race, rawName: p.rawName,
    apm: p.apm, eapm: p.eapm, cmdCount: p.cmdCount, effectiveCmdCount: p.effectiveCmdCount, buildCount: p.buildCount,
  };
}

/** 한쪽 팀의 참가자를 슬롯으로 — 컴퓨터는 바로 컴퓨터 슬롯, 회원은 회원, 나머지는 미매칭. */
function assign(players: ParsedReplayPlayer[], members: Member[], usedIds: Set<string>) {
  const rows: GameResultSlot[] = [];
  const unmatched: ParsedReplayPlayer[] = [];
  players.forEach((p) => {
    if (p.isComputer) { rows.push(slotOf(p, newComputerSlotId())); return; }
    const member = matchReplayPlayerToMember(p.rawName, members);
    if (member && !usedIds.has(member.id)) {
      usedIds.add(member.id);
      rows.push(slotOf(p, member.id));
    } else {
      unmatched.push(p);
    }
  });
  return { rows, unmatched };
}

// 사람이 먼저, 컴퓨터가 나중에 — replayDraft.ts의 assign()과 같은 기준.
function bySlotKind(a: GameResultSlot, b: GameResultSlot): number {
  return Number(isComputerSlot(a.memberId)) - Number(isComputerSlot(b.memberId));
}

/** 실제 회원으로 매칭된 자리 수 — 컴퓨터·비회원은 안 센다(replayDraft.ts의 memberSlotCount). */
function memberSlotCount(slots: GameResultSlot[]): number {
  return new Set(slots.map((s) => s.memberId).filter((id) => !isComputerSlot(id) && !isUnregisteredSlot(id))).size;
}

export async function processReplay(path: string, api: UploaderApi, members: Member[]): Promise<Outcome> {
  const name = basename(path);
  const bytes = await readFile(path);
  const file = new File([new Uint8Array(bytes)], name);

  let parsed: Awaited<ReturnType<typeof parseReplayFile>>;
  try {
    parsed = await parseReplayFile(file);
  } catch (e) {
    const why = e instanceof ReplayParseError ? e.message : (e instanceof Error ? e.message : String(e));
    return { kind: "skipped", reason: `분석 실패: ${why}`, summary: name };
  }

  const summary = `${parsed.mapName || "(맵 없음)"} · ${parsed.matchType} · ${parsed.durationSeconds ?? "?"}s`;
  const skip = (reason: string): Outcome => ({ kind: "skipped", reason, summary });
  const everyone = [...parsed.team1, ...parsed.team2];

  // ── 서버가 안 받는 갈래(유즈맵) — 홈페이지는 읽는 순간 빼고 나머지만 등록한다 ──
  if (parsed.gameTypeId !== null && REJECTED_GAME_TYPES.has(parsed.gameTypeId)) {
    return skip(`${parsed.gameTypeName || "유즈맵"} 경기는 등록할 수 없음`);
  }

  // ── 조건 미달(검토 화면이 사람 확인을 요구하던 것) ──
  if (parsed.teamSplitUncertain) return skip("팀을 두 편으로 못 나눔(맵 자체의 한계)");
  if (RULES.skipIfGuessedObservers && parsed.guessedObservers.length > 0) {
    return skip(`관전자로 추정해 뺀 사람 있음: ${parsed.guessedObservers.join(", ")}`);
  }
  if (parsed.durationSeconds !== null && parsed.durationSeconds < RULES.minDurationSec) {
    return skip(`${RULES.minDurationSec / 60}분 미만 경기`);
  }
  // 난투(FFA)의 team1은 '이긴 사람 하나' 자리라 승자를 못 가린 판은 비어 있는 게 맞다 —
  // 서버도 0103은 빈 team1을 받는다(validateReplayDraft와 같은 예외).
  if (parsed.team2.length === 0 || (parsed.team1.length === 0 && !parsed.ffa)) return skip("한쪽 팀이 비어 있음");
  if (everyone.some((p) => !p.isComputer && !p.race)) return skip("종족을 못 읽은 참가자 있음");
  if (RULES.skipIfComputer && everyone.some((p) => p.isComputer)) return skip("컴퓨터 낀 경기");

  // ── 회원 매칭 → 알려진 이름 분류 → 남은 사람은 비회원 ──
  const usedIds = new Set<string>();
  const t1 = assign(parsed.team1, members, usedIds);
  const t2 = assign(parsed.team2, members, usedIds);
  const rawNames = [...t1.unmatched, ...t2.unmatched].map((p) => p.rawName);
  // 이 조회는 편의 기능이라 실패해도 등록을 막지 않는다(replayDraft.ts와 같다).
  const known = rawNames.length > 0 ? await api.lookupReplayNameClassifications(rawNames).catch(() => []) : [];
  const kindByName = new Map(known.map((e) => [e.rawName, e.kind]));
  const settle = (p: ParsedReplayPlayer): GameResultSlot =>
    slotOf(p, kindByName.get(p.rawName) === "computer" ? newComputerSlotId() : newUnregisteredSlotId());
  const team1 = [...t1.rows, ...t1.unmatched.map(settle)].sort(bySlotKind);
  const team2 = [...t2.rows, ...t2.unmatched.map(settle)].sort(bySlotKind);

  // ── 회원이 모자라면 등록도 머지도 안 한다(홈페이지의 fewmembers 자동 제외와 같은 자리) ──
  const memberCount = memberSlotCount([...team1, ...team2]);
  if (memberCount < RULES.minMembers) {
    return skip(`회원이 ${RULES.minMembers}명 미만(${memberCount}명)인 경기`);
  }

  const replay: ReplayUpload = {
    originalName: name, displayName: name,
    // 브라우저 FileReader.readAsDataURL이 .rep(형식 없음)에 만드는 것과 같은 머리말.
    url: `data:application/octet-stream;base64,${bytes.toString("base64")}`,
  };

  // ── 중복이면 머지(지표·맵·시간은 늘, 승패는 확실할 때만, 파일은 더 길 때만) ──
  if (parsed.gameStartedAt) {
    const existing = await api.checkReplayDuplicates([parsed.gameStartedAt]);
    if (existing.includes(parsed.gameStartedAt)) {
      const payload: MergeReplayPayload = {
        replay,
        gameStartedAt: parsed.gameStartedAt,
        result: parsed.winnerSide,
        mapName: parsed.mapName || null,
        durationSeconds: parsed.durationSeconds,
        mapData: parsed.mapGrid,
        players: [...team1, ...team2].map((s) => ({
          playerName: s.rawName ?? "", race: s.race || null, apm: s.apm, eapm: s.eapm, cmdCount: s.cmdCount,
          effectiveCmdCount: s.effectiveCmdCount, buildCount: s.buildCount,
        })).filter((p) => p.playerName),
      };
      const res = await api.mergeReplay(payload);
      return res.merged ? { kind: "merged", summary } : { kind: "duplicate", summary };
    }
  }

  // ── 등록 — 승자를 못 가렸으면 결과 모름(unknown), 갈래를 아는 건만 gameType을 싣는다 ──
  const result: GameOutcome = parsed.winnerSide ?? "unknown";
  const payload: NewGameResult = {
    date: parsed.date, team1, team2, result, matchType: parsed.matchType,
    ...(parsed.gameTypeId !== null ? { gameType: parsed.gameTypeId } : {}),
    replay,
    mapName: parsed.mapName || null, gameStartedAt: parsed.gameStartedAt, durationSeconds: parsed.durationSeconds,
    mapData: parsed.mapGrid,
  };
  const created = await api.createGameResult(payload);
  return { kind: "registered", matchNo: created.matchNo, summary };
}

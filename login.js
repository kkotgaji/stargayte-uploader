// 로그인 창 스크립트 — preload가 노출한 window.uploader만 쓴다.
const f = document.getElementById("f");
const btn = document.getElementById("btn");
const err = document.getElementById("err");
window.uploader.info().then((i) => {
  document.getElementById("foot").textContent = `v${i.version} · ${i.apiBase}\n감시 폴더: ${i.replayDir}`;
});
f.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const id = document.getElementById("id").value;
  const pw = document.getElementById("pw").value;
  if (!id || !pw) { err.textContent = "아이디와 비밀번호를 넣어 주세요."; return; }
  btn.disabled = true; err.textContent = ""; err.className = "err";
  const r = await window.uploader.login(id, pw);
  if (r.ok) { err.className = "err ok"; err.textContent = `${r.nickname}님, 로그인됐어요. 트레이에서 계속 돌아가요.`; }
  else { err.textContent = r.error; btn.disabled = false; }
});

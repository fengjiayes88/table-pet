const messageElement = document.getElementById('message');
window.electronAPI.onReminderMessage((message) => {
  messageElement.textContent = String(message || '该休息啦～');
});
document.getElementById('dismiss').addEventListener('click', () => {
  window.electronAPI.dismissReminderBubble(true);
});

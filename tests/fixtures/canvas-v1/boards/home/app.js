document.querySelector('#count').addEventListener('click', event => {
  event.currentTarget.textContent = String(Number(event.currentTarget.textContent) + 1);
});

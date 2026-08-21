export interface ModalHandle {
  close: () => void;
  box: HTMLDivElement;
}

export function openModal(title: string): ModalHandle {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const box = document.createElement('div');
  box.className = 'modal-box';

  const heading = document.createElement('h3');
  heading.className = 'modal-title';
  heading.textContent = title;
  box.appendChild(heading);

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKeydown);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKeydown);

  return { close, box };
}

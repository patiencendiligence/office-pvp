import { useEffect, useState } from 'react';

/** Touch-first or narrow viewport: show virtual joystick / aim UI. */
export function useMobileGameLayout(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)');
    const narrow = window.matchMedia('(max-width: 900px)');
    const update = () => setMobile(coarse.matches || narrow.matches);
    update();
    coarse.addEventListener('change', update);
    narrow.addEventListener('change', update);
    return () => {
      coarse.removeEventListener('change', update);
      narrow.removeEventListener('change', update);
    };
  }, []);

  return mobile;
}

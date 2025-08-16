export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const safeJSON = async (res: Response) => {
  try { return await res.json(); } catch { return null; }
};

export const isVisible = () =>
  typeof document !== 'undefined'
    ? document.visibilityState === 'visible'
    : true;

export const now = () => Date.now();

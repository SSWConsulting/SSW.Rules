export const setTinaBranchToMainIfExists = () => {
  try {
    if (typeof window === "undefined") return;

    const key = "tinacms-current-branch";
    const current = window.localStorage.getItem(key);

    if (current === null) return;

    const mainJson = JSON.stringify("main");

    if (current !== mainJson) {
      window.localStorage.setItem(key, mainJson);
    }
  } catch (e) {
    console.warn("Unable to access localStorage:", e);
  }
};

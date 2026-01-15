export const setTinaBranchToMainIfExists = () => {
  try {
    if (typeof window === "undefined") return;

    const key = "tinacms-current-branch";
    if (window.localStorage.getItem(key) !== null) {
      window.localStorage.setItem(key, "main");
    }
  } catch (e) {
    console.warn("Unable to access localStorage:", e);
  }
};

export async function captureTableAsImage(tableEl) {
  if (!tableEl) {
    alert("Table not found!");
    return;
  }

  // Dynamically load html2canvas from CDN
  if (!window.html2canvas) {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
    document.head.appendChild(script);

    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
    });
  }

  // ✅ Detect theme
  const isDark = document.body.classList.contains("dark");

  const canvas = await window.html2canvas(tableEl, {
    scale: 2, // higher quality
    backgroundColor: isDark ? "#0b1220" : "#ffffff", // ✅ FIXED
    onclone: (clonedDoc) => {
      // ✅ Ensure cloned DOM has same theme
      if (isDark) clonedDoc.body.classList.add("dark");
      else clonedDoc.body.classList.remove("dark");
    },
  });

  const link = document.createElement("a");
  link.download = "table-screenshot.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

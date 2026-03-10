const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");

if (searchForm && searchInput) {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const value = searchInput.value.trim();

    if (value === "1234") {
      const isHtmlPreviewHost = window.location.hostname === "htmlpreview.github.io";

      if (isHtmlPreviewHost && window.location.search.length > 1) {
        const previewTarget = decodeURIComponent(window.location.search.slice(1));
        const gamesTarget = previewTarget.replace(/index\.html?$/i, "games.html");
        window.location.href = `${window.location.origin}${window.location.pathname}?${gamesTarget}`;
      } else {
        window.location.href = "games.html";
      }
      return;
    }

    const resourcesSection = document.getElementById("resources");
    if (resourcesSection) {
      resourcesSection.scrollIntoView({ behavior: "smooth" });
    }
  });
}

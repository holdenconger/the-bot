const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");

if (searchForm && searchInput) {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const value = searchInput.value.trim();

    if (value === "1234") {
      window.location.href = "games.html";
      return;
    }

    const resourcesSection = document.getElementById("resources");
    if (resourcesSection) {
      resourcesSection.scrollIntoView({ behavior: "smooth" });
    }
  });
}

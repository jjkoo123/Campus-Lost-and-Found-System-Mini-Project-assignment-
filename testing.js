// ===============================
// Simple JavaScript practice
// Campus Lost & Found: mini "Report Lost Item"
// ===============================

// 1. Ask the user for their name
let name = prompt("What is your name?");

// Check: name must not be empty
if (name === null || name.trim() === "") {
    alert("❌ Error: Name cannot be empty.");
} else {
    alert("Hello, " + name + "! Let's report a lost item.");

    // 2. Ask for the item name
    let item = prompt("What item did you lose? (e.g. Wallet, Phone)");

    // 3. Ask for the category (must be one from the list)
    let categories = ["Electronics", "Wallet", "Book", "Clothing", "Others"];
    let category = prompt("Category? Choose one: " + categories.join(", "));

    // 4. Ask how many days ago it was lost (must be a number 0-30)
    let daysAgo = prompt("How many days ago did you lose it? (0-30)");
    let days = Number(daysAgo);

    // ---- Input validation ----
    let errors = [];

    if (item === null || item.trim() === "") {
        errors.push("Item name is required.");
    }

    if (!categories.includes(category)) {
        errors.push("Category must be one of: " + categories.join(", "));
    }

    if (daysAgo === null || daysAgo.trim() === "" || isNaN(days)) {
        errors.push("Days must be a number.");
    } else if (days < 0 || days > 30) {
        errors.push("Days must be between 0 and 30.");
    }

    // ---- Show result ----
    if (errors.length > 0) {
        // Error message
        alert("❌ Please fix these errors:\n- " + errors.join("\n- "));
    } else {
        // Success message
        let report = {
            reporter: name,
            item: item,
            category: category,
            daysAgo: days
        };

        console.log("New lost report:", report); // see it in the browser console (F12)

        alert(
            "✅ Report submitted successfully!\n\n" +
            "Reporter: " + report.reporter + "\n" +
            "Item: " + report.item + "\n" +
            "Category: " + report.category + "\n" +
            "Lost: " + report.daysAgo + " day(s) ago"
        );

        // Show it on the page too
        document.getElementById("output").innerHTML =
            "<h3>Lost Report</h3>" +
            "<p><b>Reporter:</b> " + report.reporter + "</p>" +
            "<p><b>Item:</b> " + report.item + "</p>" +
            "<p><b>Category:</b> " + report.category + "</p>" +
            "<p><b>Lost:</b> " + report.daysAgo + " day(s) ago</p>";
    }
}
// Typing animation for hero section const typingTexts = ["FoodHub", "Delicious Meals", "Fast Delivery"]; let i = 0, j = 0, current = "", isDeleting = false; const typingSpan = document.querySelector(".typing");

function type() { if (i < typingTexts.length) { if (!isDeleting && j <= typingTexts[i].length) { current = typingTexts[i].substring(0, j++); } else if (isDeleting && j >= 0) { current = typingTexts[i].substring(0, j--); } typingSpan.textContent = current; if (j === typingTexts[i].length) isDeleting = true; if (isDeleting && j === 0) { isDeleting = false; i = (i + 1) % typingTexts.length; } } setTimeout(type, isDeleting ? 60 : 120); } type();

// Menu data const menuItems = [ { name: "Burger", price: 350 }, { name: "Pizza", price: 800 }, { name: "Chicken", price: 600 }, { name: "Fries", price: 250 }, { name: "Soda", price: 100 } ];

const menuContainer = document.getElementById("menuItems"); const cartItems = [];

function renderMenu() { menuItems.forEach((item, index) => { const div = document.createElement("div"); div.classList.add("menu-item"); div.innerHTML = <h3>${item.name}</h3> <p>Price: KES ${item.price}</p> <button onclick="addToCart(${index})">Add to Cart</button>; menuContainer.appendChild(div); }); } renderMenu();

function addToCart(index) { const item = menuItems[index]; cartItems.push(item); updateCart(); }

function updateCart() { const cart = document.getElementById("cartItems"); const totalPrice = document.getElementById("totalPrice"); cart.innerHTML = ""; let total = 0; cartItems.forEach(item => { const li = document.createElement("li"); li.textContent = ${item.name} - KES ${item.price}; cart.appendChild(li); total += item.price; }); totalPrice.textContent = total; }

function checkout() { alert("Checkout is in progress. Payment via M-Pesa will be integrated."); }

// Form submission const contactForm = document.getElementById("contactForm"); contactForm.addEventListener("submit", e => { e.preventDefault(); alert("Message sent! We'll get back to you."); });

// Back to top const backToTop = document.getElementById("backToTop"); backToTop.addEventListener("click", () => { window.scrollTo({ top: 0, behavior: "smooth" }); }); window.addEventListener("scroll", () => { backToTop.style.display = window.scrollY > 100 ? "block" : "none"; });

// Visitor counter async function loadVisitorCount() { try { const res = await fetch("/api/visitors"); const data = await res.json(); document.getElementById("visitorCount").textContent = data.count; } catch (err) { document.getElementById("visitorCount").textContent = "N/A"; } } loadVisitorCount();

// M-Pesa payment const checkoutBtn = document.getElementById("checkout-btn"); const phoneInput = document.getElementById("phone"); const paymentStatus = document.getElementById("payment-status");

checkoutBtn.addEventListener("click", async () => { const phone = phoneInput.value.trim(); if (!phone.match(/^2547\d{8}$/)) { alert("Enter a valid phone number in the format 2547XXXXXXXX"); return; } if (cartItems.length === 0) { alert("Your cart is empty"); return; }

const amount = cartItems.reduce((sum, item) => sum + item.price, 0); const name = prompt("Please enter your name for the order:"); if (!name) { alert("Name is required"); return; }

paymentStatus.textContent = "Initiating payment, please wait..."; checkoutBtn.disabled = true;

try { const response = await fetch("/api/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, amount, orderDetails: cartItems, name }), }); const data = await response.json();

if (response.ok && data.ResponseCode === "0") {
  paymentStatus.textContent =
    "Payment prompt sent! Please complete payment on your phone.";
} else {
  paymentStatus.textContent =
    "Payment initiation failed: " + (data.errorMessage || JSON.stringify(data));
}

} catch (err) { paymentStatus.textContent = "Error initiating payment: " + err.message; } finally { checkoutBtn.disabled = false; } });

// Dark mode toggle (optional future button) const toggleTheme = document.getElementById("theme-toggle"); if (toggleTheme) { toggleTheme.addEventListener("click", () => { document.body.classList.toggle("dark"); }); }



// --- 1. DATA LOGIC ---
let appData = { tenants: [], rooms: [], maintenance: [] };

window.onload = () => {
    console.log("App starting, waiting for Firebase...");
    window.dbOnValue(window.dbRef(window.db, "/"), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Ensure we are working with arrays even if Firebase sends objects
            appData.tenants = data.tenants ? Object.values(data.tenants) : [];
            appData.rooms = data.rooms ? Object.values(data.rooms) : [];
            appData.maintenance = data.maintenance ? Object.values(data.maintenance) : [];
        } else {
            appData = { tenants: [], rooms: [], maintenance: [] };
        }
        
        // Start at dashboard to see the building overview
        router('dashboard'); 
    });
};

function saveAndRefresh(page) {
    window.dbSet(window.dbRef(window.db, "/"), appData)
        .then(() => {
            console.log("Data synced!");
            router(page);
        })
        .catch((error) => alert("Error: " + error));
}

// --- 2. VIEW TEMPLATES ---
const views = {
    // DASHBOARD: Now shows the real-time status of every room in your building
    dashboard: () => `
    <h1>MARICYL BLDG. Overview</h1>
    
    <div class="card-grid" style="margin-bottom: 30px;">
        <div class="card"><h3>Total Units</h3><p>${appData.rooms.length}</p></div>
        <div class="card"><h3>Vacant</h3><p style="color: var(--success)">${appData.rooms.filter(r => !r.occupied).length}</p></div>
        <div class="card"><h3>Occupied</h3><p style="color: var(--danger)">${appData.rooms.filter(r => r.occupied).length}</p></div>
    </div>

    <div class="room-grid">
        ${appData.rooms.map(room => {
            const tenant = appData.tenants.find(t => t.unit === room.id);
            return `
                <div class="room-card ${room.occupied ? 'occupied' : 'vacant'}">
                    <img src="${room.image}" class="room-img" onerror="this.src='https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400'">
                    <div class="room-info">
                        <h3>Unit ${room.id} <small>(${room.type})</small></h3>
                        <p>📍 Floor: ${room.floor} | ${room.bedrooms}BR | ${room.bathrooms}CR</p>
                        <span class="badge">
                            <b>${room.occupied ? '👤 ' + (tenant ? tenant.name : 'Occupied') : '✅ VACANT'}</b>
                        </span>
                    </div>
                </div>
            `;
        }).join('')}
    </div>
`,

    tenants: () => `
        <h1>Tenant Directory</h1>
        <div class="card">
            <h3>Add New Tenant</h3>
            <div class="room-form">
                <input type="text" id="tName" placeholder="Full Name">
                
                <select id="tUnit">
                    <option value="">-- Select Vacant Unit --</option>
                    ${appData.rooms.filter(r => !r.occupied).map(r => `
                        <option value="${r.id}">Unit ${r.id} (${r.type})</option>
                    `).join('')}
                </select>

                <select id="tStatus">
                    <option value="Paid">Paid</option>
                    <option value="Unpaid">Unpaid</option>
                </select>

                <input type="date" id="tDate" title="Payment or Due Date">

                <button onclick="addNewTenant()" style="background: var(--accent); color: white; border: none; padding: 12px; border-radius: 5px; cursor: pointer;">
                    Add Tenant
                </button>
            </div>
        </div>

        <table border="0" width="100%" id="tenantTable" style="background: white; border-radius: 8px; margin-top: 20px;">
            <tr style="text-align: left; background: #eee;">
                <th style="padding:15px">Name</th>
                <th>Unit</th>
                <th>Status</th>
                <th>Date Info</th> 
                <th>Action</th> 
            </tr>
            ${appData.tenants.map((t, index) => `
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding:15px">${t.name}</td>
                    <td>Unit ${t.unit}</td>
                    <td>
                        <button onclick="togglePayment(${index})" 
                                style="background: ${t.status === 'Paid' ? '#2ecc71' : '#e67e22'}; 
                                       color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight:bold;">
                            ${t.status}
                        </button>
                    </td>
                    <td>
                        <small style="color: #666;">${t.status === 'Paid' ? 'Paid on:' : 'Due by:'}</small><br>
                        <strong>${t.date || 'No Date'}</strong>
                        
                        ${t.lastPaidDate ? `<br><small style="color: #7f8c8d;">Last Paid: ${t.lastPaidDate}</small>` : ''}
                        
                        ${t.amountPaid ? `<br><small style="color: var(--success); font-weight: bold;">Amount: ₱${t.amountPaid}</small>` : ''}
                    </td>
                    <td>
                        <button onclick="removeTenant(${index})" 
                                style="background: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                            Remove
                        </button>
                    </td>
                </tr>
            `).join('')}
        </table>
    `,

    maintenance: () => `
        <h1>Maintenance Requests</h1>
        <div class="card">
            <ul>
                ${appData.maintenance.length > 0 ? 
                    appData.maintenance.map(m => `<li>[Unit ${m.unit}] ${m.issue}</li>`).join('') : 
                    '<li>No pending requests.</li>'}
            </ul>
        </div>
    `
};

// --- 3. LOGIC FUNCTIONS ---
function router(page) {
    const content = views[page] ? views[page]() : '<h1>404 Not Found</h1>';
    document.getElementById('view-port').innerHTML = content;
}

function togglePayment(index) {
    setTimeout(() => {
        const tenant = appData.tenants[index];

        if (tenant.status === "Unpaid") {
            const amount = prompt(`Confirm payment for ${tenant.name}.\nHow much did they pay?`);
            
            if (amount === null || amount.trim() === "") {
                return; 
            }

            // Get current processing date
            const d = new Date();
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const today = `${year}-${month}-${day}`;

            tenant.status = "Paid";
            tenant.amountPaid = amount;
            tenant.date = today;
            tenant.lastPaidDate = today; // NEW: Saves this date permanently as history

            alert(`Payment of ₱${amount} recorded!`);
        } else {
            // Moving back to unpaid for the next billing cycle
            if (confirm(`Change ${tenant.name}'s status back to Unpaid?`)) {
                const nextDueDate = prompt("Enter next rent due date (YYYY-MM-DD):", tenant.date);
                if (nextDueDate === null) return;

                tenant.status = "Unpaid";
                tenant.date = nextDueDate; // Updates current target deadline
                tenant.amountPaid = null;  // Clears the amount tracker until they pay again
                // Note: tenant.lastPaidDate is NOT cleared here, so it stays visible!
            }
        }
        
        saveAndRefresh('tenants');
    }, 50);
}

function addNewTenant() {
    const name = document.getElementById('tName').value;
    const unit = document.getElementById('tUnit').value;
    const status = document.getElementById('tStatus').value;
    const date = document.getElementById('tDate').value;

    if (name && unit && date) {
        appData.tenants.push({
            id: Date.now(),
            name: name,
            unit: unit,
            status: status,
            date: date
        });

        // Link tenant to room
        const room = appData.rooms.find(r => r.id === unit);
        if (room) room.occupied = true;

        saveAndRefresh('tenants'); 
    } else {
        alert("Please fill in Name, Unit, and Date.");
    }
}

function removeTenant(index) {
    if (confirm("Remove this tenant? Room will become vacant.")) {
        const unitToVacate = appData.tenants[index].unit;
        appData.tenants.splice(index, 1);
        
        const room = appData.rooms.find(r => r.id === unitToVacate);
        if (room) room.occupied = false;
        
        saveAndRefresh('tenants');
    }
}

function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('active');
    }
}

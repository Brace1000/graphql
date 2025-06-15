
import { executeGraphQLQuery, formatSize } from './main.js';
export async function initAudits(token) {


const auditQuery = `{
  user {
    id
    login
    auditRatio
    audits(order_by: {createdAt: desc}) {
      id
      closureType
      auditedAt
      closedAt
      createdAt
      group {
        captainId
        captainLogin
        path
        members {
          userId
          userLogin
        }
      }
      private {
        code
      }
    }
    transactions(
      order_by: {createdAt: desc},
      where: {
        type: {_in: ["up", "down"]}
      }
    ) {
      type
      amount
      createdAt
      path
    }
  }
}`;


try {
  const auditData = await executeGraphQLQuery(auditQuery, token);
  
  // Extract user data from the response. It's an array with one user.
  const user = auditData.data.user[0];
  if (!user) {
      throw new Error("User data not found in API response.");
  }

  // Extract the data we need
  const audits = user.audits || [];
  const transactions = user.transactions || []; 
  const auditRatio = user.auditRatio || 0;

  
  displayAuditInfo(audits, transactions, auditRatio);

 
  updateAudits(audits);
  setupAuditDropdownListeners();

} catch (error) {
  console.error("Error fetching or processing audit data:", error);
  document.getElementById('audit-info').innerHTML = `<p>Error loading audit data</p>`;
}
}


function displayAuditInfo(audits, transactions, auditRatio) {
  // Ensure we have arrays to work with to prevent errors
  audits = audits || [];
  transactions = transactions || [];

  const auditsDoneSizeBytes = transactions
    .filter(tx => tx.type === 'up')
    .reduce((sum, tx) => sum + tx.amount, 0);

  // Sum the amounts from the 'down' transactions (Audits Received)
  const auditsReceivedSizeBytes = transactions
    .filter(tx => tx.type === 'down')
    .reduce((sum, tx) => sum + tx.amount, 0);

  // Format the calculated sizes for display
  const formattedAuditsDoneSize = formatSize(auditsDoneSizeBytes);
  const formattedAuditsReceivedSize = formatSize(auditsReceivedSizeBytes);


  window.auditData = {
    auditsDone: transactions.filter(tx => tx.type === 'up').length,
    auditsReceived: transactions.filter(tx => tx.type === 'down').length,
    auditsDoneSize: auditsDoneSizeBytes,
    auditsReceivedSize: auditsReceivedSizeBytes,
  };

  // Display audit ratio info (this part remains the same)
  const auditContainer = document.getElementById('audit-info');
  let ratioColor = '#ef4444'; // Default red
  if (auditRatio >= 1.5) ratioColor = '#f59e0b'; // Orange
  if (auditRatio >= 1.0 && auditRatio < 1.5) ratioColor = '#10b981'; // Green

  auditContainer.innerHTML = `
    <h2>Audit Status</h2>
    <div class="audit-display">
      <div class="audit-ratio-box" style="background: ${ratioColor}">
        ${auditRatio.toFixed(1)}
      </div>
      <p class="audit-label">Current Audit Ratio</p>
    </div>
   
  `;

  // Generate the graph with the correct data
  generateAuditGraph();
}
export function updateAudits(audits) {
  const auditsBtn = document.getElementById("audits-btn");
  const auditsDropdown = document.getElementById("audits-dropdown");

  if (!auditsBtn || !auditsDropdown) {
    console.error("Audit elements not found in the DOM");
    return; // Exit if elements are missing
  }

  auditsDropdown.innerHTML = ""; 

  // Filter for available audits (not closed)
  const availableAudits = audits.filter(audit => audit.closedAt === null);
  console.log("Available Audits:", availableAudits); 

  if (availableAudits.length === 0) {
    auditsBtn.textContent = "No audits";
    auditsDropdown.style.display = "none";
    return;
  }

  auditsBtn.textContent = `Audits (${availableAudits.length})`;

  availableAudits.forEach((audit) => {
    const projectname = audit.group.path ? audit.group.path.split("/").pop() : "Unknown Project";
    let members = "";

    if (audit.group.members && Array.isArray(audit.group.members)) {
      for (let user of audit.group.members) {
        members += " " + (user.userLogin || "Unknown");
      }
    }

    const auditDiv = document.createElement("div");
    auditDiv.classList.add("audit-item");
    auditDiv.innerHTML = `
      <p><strong>Project:</strong> ${projectname}</p>
      <p><strong>Group Admin:</strong> ${audit.group.captainLogin || "Unknown"}</p>
      <p><strong>Members:</strong> ${members || "None"}</p>
      <p><strong>Audit Code:</strong> ${audit.private && audit.private.code ? audit.private.code : "N/A"}</p>
    `;

    auditsDropdown.appendChild(auditDiv);
  });

 
  console.log("Audits Dropdown Content:", auditsDropdown.innerHTML);
}
function setupAuditDropdownListeners() {
  const auditsBtn = document.getElementById("audits-btn");
  const auditsDropdown = document.getElementById("audits-dropdown");

  if (!auditsBtn || !auditsDropdown) {
    console.error("Audit elements not found when setting up listeners");
    return; // Exit if elements are missing
  }

  let show = false;

  auditsBtn.addEventListener("click", function (event) {
    event.stopPropagation(); // Prevents the document click from firing immediately
    show = !show;
    if (show && auditsBtn.textContent !== "No audits") {
      auditsDropdown.style.display = "block";
    } else {
      auditsDropdown.style.display = "none";
    }
    console.log("Dropdown Toggled. Show:", show); // Log dropdown state
  });

  document.addEventListener("click", function (event) {
    // Check if the click is outside the dropdown and button
    if (!auditsDropdown.contains(event.target) && event.target !== auditsBtn) {
      auditsDropdown.style.display = "none";
      show = false; // Ensure state is updated
      console.log("Dropdown Hidden. Show:", show); // Log dropdown state
    }
  });
}
function generateAuditGraph() {
  console.log("Audit Data:", window.auditData);
  const { auditsDone, auditsReceived, auditsDoneSize, auditsReceivedSize } = window.auditData;

  const auditGraph = document.getElementById('audit-graph');
  if (!auditGraph) {
    console.error("Audit graph element not found");
    return;
  }

  if (!auditsDone && !auditsReceived) {
    auditGraph.innerHTML = '<p>No audit data available</p>';
    return;
  }

  const width = 800;
  const height = 400;
  const padding = 50;
  const barPadding = 30;

  // Create SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  // Draw bars
  const categories = ['Audits Done', 'Audits Received'];
  const values = [auditsDone, auditsReceived];
  const maxValue = Math.max(...values, 1); // Prevent division by zero

  categories.forEach((category, i) => {
    const x = padding + i * ((width - 2 * padding) / categories.length);
    const barHeight = (values[i] / maxValue) * (height - 2 * padding);
    const y = height - padding - barHeight;

    // Add bar
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', (width - 2 * padding) / categories.length - barPadding);
    rect.setAttribute('height', barHeight);
    rect.setAttribute('fill', i === 0 ? '#4f46e5' : '#4f46e5');
    svg.appendChild(rect);

    // Add size label on top of the bar
    const size = i === 0 ? auditsDoneSize : auditsReceivedSize;
    const formattedSize = formatSize(size);
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x + ((width - 2 * padding) / categories.length - barPadding) / 2);
    text.setAttribute('y', y - 5); // Position above the bar
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '12px');
    text.setAttribute('fill', '#4f46e5');
    text.textContent = formattedSize;
    svg.appendChild(text);

    // Add category label below the bar
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x + ((width - 2 * padding) / categories.length - barPadding) / 2);
    label.setAttribute('y', height - padding + 20);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '12px');
    label.setAttribute('fill', 'white');
    label.textContent = category;
    svg.appendChild(label);
  });

  // Add axes
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', padding);
  xAxis.setAttribute('y1', height - padding);
  xAxis.setAttribute('x2', width - padding);
  xAxis.setAttribute('y2', height - padding);
  xAxis.setAttribute('stroke', '#1e293b');
  svg.appendChild(xAxis);

  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', padding);
  yAxis.setAttribute('y1', padding);
  yAxis.setAttribute('x2', padding);
  yAxis.setAttribute('y2', height - padding);
  yAxis.setAttribute('stroke', '#1e293b');
  svg.appendChild(yAxis);

  // Add title
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  title.setAttribute('x', width / 2);
  title.setAttribute('y', 25);
  title.setAttribute('text-anchor', 'middle');
  title.setAttribute('font-weight', 'semi-bold');
  title.textContent = 'Audits Done vs. Audits Received';
  title.setAttribute('fill', 'white');
  svg.appendChild(title);

  auditGraph.innerHTML = '';
  auditGraph.appendChild(svg);
}
// Initialize the audits system when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM fully loaded, initializing audits");
  const token = localStorage.getItem('jwt');
  if (token) {
    initAudits(token);
  } else {
    console.error("No token found. User is not authenticated.");
  }
});

// In case the code is loaded after DOMContentLoaded has already fired
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  console.log("DOM already loaded, initializing audits immediately");
  const token = localStorage.getItem('jwt');
  if (token) {
    setTimeout(() => initAudits(token), 1);
  } else {
    console.error("No token found. User is not authenticated.");
  }
}
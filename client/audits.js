
import { executeGraphQLQuery, formatSize } from './main.js';
export async function initAudits(token) {
  // Fetch audit data with group information
  const auditQuery = `{
    user {
      id
      login
      auditRatio
      audits{
        id
        closureType
        auditedAt
        closedAt
        createdAt
        group {
          captain {
            canAccessPlatform
          }
          captainId
          captainLogin
          path
          createdAt
          updatedAt
          members {
            userId
            userLogin
          }
        }
        private {
          code
        }
      }
    }
  }`;

  try {
    const auditData = await executeGraphQLQuery(auditQuery, token);
    console.log('Audit Query:', auditQuery);
    console.log('Audit Data Response:', JSON.stringify(auditData, null, 2));

    // Extract audits and user data from the response
    const user = auditData.data.user[0];
    //const audits = user.audits || [];
    const auditRatio = user.auditRatio || 0;

    const audits = auditData.data.user.flatMap((user) => user.audits || []);

    // Display the audit information
    displayAuditInfo(audits, auditRatio);
    updateAudits(audits);
    
    // Setup event listeners for the audits dropdown after elements are populated
    setupAuditDropdownListeners();
  } catch (error) {
    console.error("Error fetching audit data:", error);
    document.getElementById('audit-info').innerHTML = `<p>Error loading audit data</p>`;
  }
}

function displayAuditInfo(audits, auditRatio) {
  audits = audits || [];
  // Count audits done and received
  const auditsDone = audits.filter((audit) => audit.closureType === 'succeeded').length;
  const auditsReceived = audits.filter((audit) =>
    ['expired', 'unused', 'failed', 'autoFailed', 'canceled', 'invalidated', 'reassigned'].includes(audit.closureType)
  ).length;

  // Use the correct size per audit
  const sizePerAuditDoneBytes = 28539.02; // Size per audit for 'Done' audits
  const sizePerAuditReceivedBytes = 22488.76; // Size per audit for 'Received' audits

  // Calculate total sizes for audits done and received
  const auditsDoneSizeBytes = auditsDone * sizePerAuditDoneBytes;
  const auditsReceivedSizeBytes = auditsReceived * sizePerAuditReceivedBytes;

  // Format sizes (using the formatSize function which expects bytes)
  const formattedAuditsDoneSize = formatSize(auditsDoneSizeBytes);
  const formattedAuditsReceivedSize = formatSize(auditsReceivedSizeBytes);

  // Display audit information
  document.getElementById('audit-info').innerHTML = `
    <p><strong>Audit Ratio:</strong> ${auditRatio.toFixed(1)}</p>
    <p><strong>Audits Done:</strong> ${auditsDone}</p>
    <p><strong>Audits Received:</strong> ${auditsReceived}</p>
    <p><strong>Audits Done Size:</strong> ${formattedAuditsDoneSize}</p>
    <p><strong>Audits Received Size:</strong> ${formattedAuditsReceivedSize}</p>
  `;

  // Store data for graphs
  window.auditData = {
    auditsDone: auditsDone,
    auditsReceived: auditsReceived,
    auditsDoneSize: auditsDoneSizeBytes,
    auditsReceivedSize: auditsReceivedSizeBytes,
  };

  // Now generate the graph with the correct data
  generateAuditGraph();
}
export function updateAudits(audits) {
  const auditsBtn = document.getElementById("audits-btn");
  const auditsDropdown = document.getElementById("audits-dropdown");

  if (!auditsBtn || !auditsDropdown) {
    console.error("Audit elements not found in the DOM");
    return; // Exit if elements are missing
  }

  auditsDropdown.innerHTML = ""; // Clear previous audits

  // Filter for available audits (not closed)
  const availableAudits = audits.filter(audit => audit.closedAt === null);
  console.log("Available Audits:", availableAudits); // Log available audits

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

  // Log the dropdown content after updating
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
  const { auditsDone, auditsReceived, auditsDoneSize, auditsReceivedSize } = window.auditData ;
   

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
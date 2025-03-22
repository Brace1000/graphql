import { fetchSkillData, displaySkillInfo } from './skills.js';

// Configuration
const config = {
  apiEndpoint: 'https://learn.zone01kisumu.ke/api/graphql-engine/v1/graphql',
  authEndpoint: 'https://learn.zone01kisumu.ke/api/auth/signin',
};

// Handle login form submission
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  // Create Basic Auth credentials
  const credentials = btoa(`${username}:${password}`);

  try {
    // Send login request
    const response = await fetch(config.authEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({}),
    });

    const responseBody = await response.json();
    console.log('Response Status:', response.status);
    console.log('Response Body:', responseBody);

    if (response.ok) {
      let token;
      if (typeof responseBody === 'string') {
        // If the response is a plain string (JWT token)
        token = responseBody;
      } else if (responseBody.jwt) {
        // If the response is a JSON object with a `jwt` field
        token = responseBody.jwt;
      } else {
        showError('Invalid response from server');
        return;
      }
      localStorage.setItem('jwt', token);
      showProfilePage();
    } else {
      showError(responseBody.error || 'Login failed');
    }
  } catch (error) {
    showError('Login service unavailable: ' + error.message);
  }
});

// Show profile page
function showProfilePage() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('profile-page').style.display = 'block';

  // Fetch user data
  fetchUserData();

  // Fetch audit closure type enum values
  const token = localStorage.getItem('jwt');
  if (token) {
    //fetchAuditClosureTypeEnum(token);
    // Fetch skill data
    fetchSkillData(token) // Fetch skills data
      .then(skills => {
        displaySkillInfo(skills); // Display the skills
      })
      .catch(err => {
        console.error('Error fetching skills:', err);
        showError('Error fetching skills data.');
      });
  }
}
// Show error message
function showError(message) {
  document.getElementById('error-message').textContent = message;
}

// Fetch user data using GraphQL
async function fetchUserData() {
  const token = localStorage.getItem('jwt');
  if (!token) {
    showError('Not authenticated');
    return;
  }
  try {
    // Fetch user info
    const userQuery = `{
      user {
        id
        login
      }
    }`;
    const userData = await executeGraphQLQuery(userQuery, token);
    displayUserInfo(userData.data.user[0]);

    // Fetch XP data
    const xpQuery = `{
      transaction(where: {type: {_eq: "xp"}}, order_by: {createdAt: asc}) {
        id
        amount
        createdAt
        path
        object {
          name
          type
        }
      }
    }`;
    const xpData = await executeGraphQLQuery(xpQuery, token);
    displayXPInfo(xpData.data.transaction);

    // Fetch progress data
    const progressQuery = `{
      progress(where: {grade: {_gt: 0}}, order_by: {updatedAt: desc}) {
        id
        grade
        updatedAt
        path
        object {
          name
          type
        }
      }
    }`;
    const progressData = await executeGraphQLQuery(progressQuery, token);
    displayProgressInfo(progressData.data.progress);

    // Fetch audit data
    const auditQuery = `{
      user {
        audits {
          id
          closureType
          auditedAt
          closedAt
          createdAt
        }
      }
    }`;
    const auditData = await executeGraphQLQuery(auditQuery, token);
    console.log('Audit Query:', auditQuery);
    console.log('Audit Data Response:', JSON.stringify(auditData, null, 2));
    
    // Extract audits from the response
const audits = auditData.data.user.flatMap((user) => user.audits || []);
displayAuditInfo(audits);

    // Fetch distinct transaction types
    const distinctTypeQuery = `{
      transaction(distinct_on: type) {
        type
      }
    }`;
    const distinctTypeData = await executeGraphQLQuery(distinctTypeQuery, token);
    console.log('Distinct Type Query:', distinctTypeQuery);
    console.log('Distinct Type Data Response:', JSON.stringify(distinctTypeData, null, 2));

    // Display distinct types (optional)
    displayDistinctTypes(distinctTypeData.data.transaction);
  } catch (error) {
    showError('Error fetching data: ' + error.message);
  }
}

// Execute GraphQL query
// In main.js
export async function executeGraphQLQuery(query, token) {
  const response = await fetch(config.apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL error: ${response.status}`);
  }
  return response.json();
}

// Display user info
function displayUserInfo(user) {
  document.getElementById('user-info').innerHTML = `
    <h2>User Information</h2>
    <p><strong>Login:</strong> ${user.login}</p>
    <p><strong>ID:</strong> ${user.id}</p>
  `;
}

// Display XP info
function displayXPInfo(transactions) {
  let totalXP = 0;
  transactions.forEach((tx) => {
    totalXP += tx.amount;
  });

  document.getElementById('xp-info').innerHTML = `
    <h2>XP Information</h2>
    <p><strong>Total XP:</strong> ${totalXP.toLocaleString()}</p>
    <p><strong>Transactions:</strong> ${transactions.length}</p>
  `;

  // Store data for graphs
  window.xpData = transactions;
  generateXPGraph();
}

// Display progress info
function displayProgressInfo(progress) {
  const totalProjects = progress.length;
  const totalGrades = progress.reduce((sum, proj) => sum + proj.grade, 0);

  document.getElementById('progress-info').innerHTML = `
    <h2>Progress Information</h2>
    <p><strong>Completed Projects:</strong> ${totalProjects}</p>
    <p><strong>Total Grades:</strong> ${totalGrades}</p>
    <p><strong>Average Grade:</strong> ${(totalGrades / totalProjects).toFixed(2)}</p>
    <p><strong>Latest Project:</strong> ${progress[0]?.path || 'None'}</p>
  `;

  // Store data for graphs
  window.progressData = progress;
  generateProjectsGraph();
}

// Display audit info
function displayAuditInfo(audits) {
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
  const auditsDoneSizeBytes = auditsDone * sizePerAuditDoneBytes; // Total size for audits done, in bytes
  const auditsReceivedSizeBytes = auditsReceived * sizePerAuditReceivedBytes; // Total size for audits received, in bytes

  // Format sizes (using the formatSize function which expects bytes)
  const formattedAuditsDoneSize = formatSize(auditsDoneSizeBytes); // Format audits done size
  const formattedAuditsReceivedSize = formatSize(auditsReceivedSizeBytes); // Format audits received size
// Calculate audit ratio (handling division by 0)
   const auditRatio = auditsReceived === 0 ? 0 : (auditsDone / auditsReceived).toFixed(1);

  // Display audit information
  document.getElementById('audit-info').innerHTML = `
    
     <p><strong>Audit Ratio:</strong> ${auditRatio}</p>
  `;

  // Store data for graphs
  window.auditData = {
    auditsDone: auditsDone,
    auditsReceived: auditsReceived,
    auditsDoneSize: auditsDoneSizeBytes, // Store the size in bytes
    auditsReceivedSize: auditsReceivedSizeBytes, // Store the size in bytes
  };

  // Now generate the graph with the correct data
  generateAuditGraph();
}
// Generate XP graph
function generateXPGraph() {
  if (!window.xpData || window.xpData.length === 0) {
    document.getElementById('xp-graph').innerHTML = '<p>No XP data available</p>';
    return;
  }

  const data = window.xpData;
  const width = 800;
  const height = 400;
  const padding = 50;

  // Process data for the graph
  let cumulativeXP = 0;
  const graphData = data.map((tx) => {
    cumulativeXP += tx.amount;
    return {
      date: new Date(tx.createdAt),
      xp: cumulativeXP,
    };
  });

  // Create SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  // Create path for the line
  const pathData = graphData
    .map((point, i) => {
      const x = padding + ((point.date - graphData[0].date) / (graphData[graphData.length - 1].date - graphData[0].date)) * (width - 2 * padding);
      const y = height - padding - (point.xp / cumulativeXP) * (height - 2 * padding);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#6366f1');
  path.setAttribute('stroke-width', '2');
  svg.appendChild(path);

  // Add axes
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', padding);
  xAxis.setAttribute('y1', height - padding);
  xAxis.setAttribute('x2', width - padding);
  xAxis.setAttribute('y2', height - padding);
  xAxis.setAttribute('stroke', 'white');
  svg.appendChild(xAxis);

  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', padding);
  yAxis.setAttribute('y1', padding);
  yAxis.setAttribute('x2', padding);
  yAxis.setAttribute('y2', height - padding);
  yAxis.setAttribute('stroke', 'white');
  
  svg.appendChild(yAxis);

  // Add labels
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  title.setAttribute('x', width / 2);
  title.setAttribute('y', 25);
  title.setAttribute('text-anchor', 'middle');
  title.setAttribute('font-weight', 'semi-bold');
  title.setAttribute('fill', 'white');
  title.textContent = 'XP Earned Over Time';
  title.setAttribute('fill', 'white');
  svg.appendChild(title);

  const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  xLabel.setAttribute('x', width / 2);
  xLabel.setAttribute('y', height - 10);
  xLabel.setAttribute('text-anchor', 'middle');
  title.setAttribute('fill', 'white');
  xLabel.textContent = 'Date';
  xLabel.setAttribute('fill', 'white');
  
  svg.appendChild(xLabel);

  const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  yLabel.setAttribute('x', -height / 2);
  yLabel.setAttribute('y', 15);
  yLabel.setAttribute('text-anchor', 'middle');
  yLabel.setAttribute('transform', 'rotate(-90)');
  yLabel.setAttribute('fill', 'white');
  yLabel.textContent = 'XP';
 
  svg.appendChild(yLabel);

  document.getElementById('xp-graph').innerHTML = '';
  document.getElementById('xp-graph').appendChild(svg);
}

// Generate projects graph
function generateProjectsGraph() {
  if (!window.progressData || window.progressData.length === 0) {
    document.getElementById('projects-graph').innerHTML = '<p>No progress data available</p>';
    return;
  }

  // Group projects by path
  const projects = {};
  window.progressData.forEach((proj) => {
    const pathParts = proj.path.split('/');
    const category = pathParts[pathParts.length - 2] || 'unknown';

    if (!projects[category]) {
      projects[category] = {
        count: 0,
        totalGrade: 0,
      };
    }

    projects[category].count++;
    projects[category].totalGrade += proj.grade;
  });

  // Prepare data for the bar chart
  const categories = Object.keys(projects);

  // Set up dimensions
  const width = 800;
  const height = 400;
  const padding = 50;
  const barPadding = 30;
  const barWidth = (width - 2 * padding) / categories.length - barPadding;

  // Create SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  // Draw bars
  categories.forEach((category, i) => {
    const x = padding + i * (barWidth + barPadding);
    const barHeight = (projects[category].count / Math.max(...categories.map((c) => projects[c].count))) * (height - 2 * padding);
    const y = height - padding - barHeight;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barWidth);
    rect.setAttribute('height', barHeight);
    rect.setAttribute('fill', '#48bb78');
    svg.appendChild(rect);

    // Add category label
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x + barWidth / 2);
    label.setAttribute('y', height - padding + 20);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '12px');
    label.textContent = category;
    svg.appendChild(label);
  });

  // Add axes
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', padding);
  xAxis.setAttribute('y1', height - padding);
  xAxis.setAttribute('x2', width - padding);
  xAxis.setAttribute('y2', height - padding);
  xAxis.setAttribute('stroke', 'white');
  svg.appendChild(xAxis);

  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', padding);
  yAxis.setAttribute('y1', padding);
  yAxis.setAttribute('x2', padding);
  yAxis.setAttribute('y2', height - padding);
  yAxis.setAttribute('stroke', 'white');
  svg.appendChild(yAxis);

  // Add title
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  title.setAttribute('x', width / 2);
  title.setAttribute('y', 25);
  title.setAttribute('text-anchor', 'middle');
  title.setAttribute('font-weight', 'white');
  title.textContent = 'Projects Completed by Category';
  svg.appendChild(title);

  document.getElementById('projects-graph').innerHTML = '';
  document.getElementById('projects-graph').appendChild(svg);
}

// Generate audit graph
function generateAuditGraph() {
  const { auditsDone, auditsReceived, auditsDoneSize, auditsReceivedSize } = window.auditData;

  if (!auditsDone && !auditsReceived) {
    document.getElementById('audit-graph').innerHTML = '<p>No audit data available</p>';
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
  const maxValue = Math.max(...values);

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
 // xLabel.setAttribute('fill', 'white');
  svg.appendChild(xAxis);

  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', padding);
  yAxis.setAttribute('y1', padding);
  yAxis.setAttribute('x2', padding);
  yAxis.setAttribute('y2', height - padding);
  yAxis.setAttribute('stroke', '#1e293b');
 // xLabel.setAttribute('fill', 'white');
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

  document.getElementById('audit-graph').innerHTML = '';
  document.getElementById('audit-graph').appendChild(svg);
}

// Handle logout
document.getElementById('logout-button').addEventListener('click', () => {
  localStorage.removeItem('jwt');
  document.getElementById('login-page').style.display = 'block';
  document.getElementById('profile-page').style.display = 'none';
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('jwt')) {
    showProfilePage();
    //fetchAuditSchema(); // Fetch audit schema
  } else {
    document.getElementById('login-page').style.display = 'block';
  }
});

function formatSize(bytes) {
  if (bytes >= 1048576) { // 1 MB = 1048576 bytes
    return `${(bytes / 1048576).toFixed(2)} MB`;
  } else if (bytes >= 1024) { // 1 KB = 1024 bytes
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else {
    return `${bytes} bytes`;
  }
}
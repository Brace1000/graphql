import { fetchSkillData, displaySkillInfo } from './skills.js';

import { initAudits, updateAudits } from './audits.js';
// Configuration
const config = {
  apiEndpoint: 'https://learn.zone01kisumu.ke/api/graphql-engine/v1/graphql',
  authEndpoint: 'https://learn.zone01kisumu.ke/api/auth/signin',
};

// Handle login form submission
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

// Handle password visibility toggle
document.getElementById('toggle-password').addEventListener('click', function () {
  const passwordInput = document.getElementById('password');
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    this.textContent = "🙈"; // Hide icon
  } else {
    passwordInput.type = "password";
    this.textContent = "👁️"; // Show icon
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
      transaction(
        where: {
          type: {_eq: "xp"},
          eventId: {_eq: 75}
        }, 
        order_by: {createdAt: asc}
      ) {
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
  } catch (error) {
    console.error("Error fetching XP data:", error);
    document.getElementById('xp-info').innerHTML = `
      <h2>XP Information</h2>
      <p class="error">Error loading XP data</p>
    `;
    const xpData = await executeGraphQLQuery(xpQuery, token);
    displayXPInfo(xpData.data.transaction);

    // Fetch progress data
    const progressQuery = `{
      progress(
        where: {
          grade: {_gt: 0},
          eventId: {_eq: 75}
        }, 
        order_by: {updatedAt: desc}
      ) {
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

  } 
}

// Execute GraphQL query

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
    <p><strong>Total XP (Module 75):</strong> ${totalXP.toLocaleString()}</p>
    <p><strong>Projects Completed:</strong> ${transactions.length}</p>
  `;

  window.xpData = transactions;
  generateXPGraph();
}

// Display progress info
function displayProgressInfo(progress) {
  const totalProjects = progress.length;
  const totalGrades = progress.reduce((sum, proj) => sum + proj.grade, 0);
  const averageGrade = totalProjects > 0 ? (totalGrades / totalProjects).toFixed(2) : 0;

  document.getElementById('progress-info').innerHTML = `
    <h2>Module 75 Progress</h2>
    <p><strong>Completed Projects:</strong> ${totalProjects}</p>
    <p><strong>Total Grades:</strong> ${totalGrades}</p>
    <p><strong>Average Grade:</strong> ${averageGrade}</p>
    <p><strong>Latest Project:</strong> ${progress[0]?.path || 'None'}</p>
  `;

  window.progressData = progress;
}

// Generate XP graph
// Enhanced XP Graph Function
function generateXPGraph() {
  const container = document.getElementById('xp-graph');
  container.innerHTML = '';

  if (!window.xpData || window.xpData.length === 0) {
    container.innerHTML = '<p>No XP data available for Module 75</p>';
    return;
  }

  // Sort data by date
  const sortedData = [...window.xpData].sort((a, b) => 
    new Date(a.createdAt) - new Date(b.createdAt)
  );

  // Calculate cumulative XP
  let cumulativeXP = 0;
  const points = sortedData.map(tx => {
    cumulativeXP += tx.amount;
    return {
      date: new Date(tx.createdAt),
      xp: cumulativeXP,
      amount: tx.amount,
      path: tx.path
    };
  });

  // Graph dimensions
  const width = container.clientWidth;
  const height = 400;
  const padding = 60;

  // Create SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.style.backgroundColor = '#1e293b';

  // Calculate scales
  const xScale = date => {
    const dateRange = points[points.length-1].date - points[0].date;
    return padding + ((date - points[0].date) / dateRange) * (width - 2*padding);
  };

  const yScale = xp => {
    const maxXP = points[points.length-1].xp;
    return height - padding - (xp / maxXP) * (height - 2*padding);
  };

  // Create line path
  let pathData = `M ${xScale(points[0].date)},${yScale(points[0].xp)}`;
  points.forEach(point => {
    pathData += ` L ${xScale(point.date)},${yScale(point.xp)}`;
  });

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#6366f1');
  path.setAttribute('stroke-width', '3');
  svg.appendChild(path);

  // Add data points with tooltips
  points.forEach(point => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', xScale(point.date));
    circle.setAttribute('cy', yScale(point.xp));
    circle.setAttribute('r', '5');
    circle.setAttribute('fill', '#6366f1');
    circle.setAttribute('data-xp', point.xp);
    circle.setAttribute('data-date', point.date.toLocaleDateString());
    circle.setAttribute('data-path', point.path);
    svg.appendChild(circle);
  });

  // Add axes
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', padding);
  xAxis.setAttribute('y1', height - padding);
  xAxis.setAttribute('x2', width - padding);
  xAxis.setAttribute('y2', height - padding);
  xAxis.setAttribute('stroke', '#94a3b8');
  svg.appendChild(xAxis);

  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', padding);
  yAxis.setAttribute('y1', height - padding);
  yAxis.setAttribute('x2', padding);
  yAxis.setAttribute('y2', padding);
  yAxis.setAttribute('stroke', '#94a3b8');
  svg.appendChild(yAxis);

  // Add labels
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  title.setAttribute('x', width / 2);
  title.setAttribute('y', 30);
  title.setAttribute('text-anchor', 'middle');
  title.setAttribute('fill', 'white');
  title.textContent = 'Module 75 XP Progression';
  svg.appendChild(title);

  container.appendChild(svg);

  // Add interactive tooltips
  const tooltip = document.createElement('div');
  tooltip.style.position = 'absolute';
  tooltip.style.background = 'rgba(30, 41, 59, 0.9)';
  tooltip.style.color = 'white';
  tooltip.style.padding = '8px 12px';
  tooltip.style.borderRadius = '4px';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.display = 'none';
  tooltip.style.border = '1px solid #6366f1';
  container.appendChild(tooltip);

  svg.querySelectorAll('circle').forEach(circle => {
    circle.addEventListener('mouseover', (e) => {
      tooltip.style.display = 'block';
      tooltip.innerHTML = `
        <div><strong>Date:</strong> ${circle.getAttribute('data-date')}</div>
        <div><strong>Total XP:</strong> ${parseInt(circle.getAttribute('data-xp')).toLocaleString()}</div>
        <div><strong>Project:</strong> ${circle.getAttribute('data-path').split('/').pop()}</div>
      `;
    });
    
    circle.addEventListener('mousemove', (e) => {
      tooltip.style.left = `${e.clientX + 15}px`;
      tooltip.style.top = `${e.clientY - 15}px`;
    });
    
    circle.addEventListener('mouseout', () => {
      tooltip.style.display = 'none';
    });
  });
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
    //initAudits(); // Fetch audit schema
  } else {
    document.getElementById('login-page').style.display = 'block';
  }
});

 export function formatSize(bytes) {
  if (bytes >= 1048576) { // 1 MB = 1048576 bytes
    return `${(bytes / 1048576).toFixed(2)} MB`;
  } else if (bytes >= 1024) { // 1 KB = 1024 bytes
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else {
    return `${bytes} bytes`;
  }
}
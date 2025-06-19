import { fetchSkillData, displaySkillInfo } from './skills.js';

import { initAudits, updateAudits } from './audits.js';
// Configuration
const config = {
  apiEndpoint: 'https://learn.zone01kisumu.ke/api/graphql-engine/v1/graphql',
  authEndpoint: 'https://learn.zone01kisumu.ke/api/auth/signin',
};

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  
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
    fetchSkillData(token) 
      .then(skills => {
        displaySkillInfo(skills); 
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
        attrs
      }
    }`;
    const userData = await executeGraphQLQuery(userQuery, token);
    displayUserInfo(userData.data.user[0]);

      // Fetch current level in module 75
      const levelQuery = `{
        user {
          events(where: {eventId: {_eq: 75}}) {
            level
          }
        }
      }`;
      
      const levelData = await executeGraphQLQuery(levelQuery, token);
      displayModuleLevel(levelData.data.user[0].events[0]?.level || 0);
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

  }
}
// Add this new function to display the level
function displayModuleLevel(level) {
  const levelContainer = document.getElementById('level-info');
  
  levelContainer.innerHTML = `
    <h2>Module Level</h2>
    <div class="level-display">
      <div class="level-circle">
        ${level}
    
  `;
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

function displayUserInfo(user) {
  const userInfoCard = document.getElementById('user-info');
  if (!userInfoCard) {
      console.error("User info card with id='user-info' not found!");
      return;
  }

  const calculateAge = (dobString) => {
    if (!dobString) return 'N/A';
    const birthDate = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // --- EXTRACT ALL USER DETAILS ---
  const fullName = `${user.attrs.firstName || ''} ${user.attrs.lastName || ''}`.trim();
  const campus = user.attrs.campus || 'Kisumu';
  const email = user.attrs.email || 'Not available';
  const username = user.login;
  const dateOfBirth = user.attrs.dateOfBirth || null; // Assuming the field is 'dateOfBirth'
  const age = calculateAge(dateOfBirth);
  
 
  const formattedDob = dateOfBirth 
    ? new Date(dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) 
    : 'N/A';


  userInfoCard.innerHTML = `
    <h2>Welcome back, <span id="welcome-username" class="welcome-username-toggle">${username}</span>!</h2>
    
    <div id="user-details-panel" class="user-details-panel">
      <div class="user-detail-item">
        <span class="detail-label">Full Name:</span>
        <span class="detail-value">${fullName || 'N/A'}</span>
      </div>
      <div class="user-detail-item">
        <span class="detail-label">Email:</span>
        <span class="detail-value">${email}</span>
      </div>
      <div class="user-detail-item">
        <span class="detail-label">Campus:</span>
        <span class="detail-value">${campus}</span>
      </div>
      <div class="user-detail-item">
        <span class="detail-label">Date of Birth:</span>
        <span class="detail-value">${formattedDob}</span>
      </div>
      <div class="user-detail-item">
        <span class="detail-label">Age:</span>
        <span class="detail-value">${age}</span>
      </div>
      <div class="user-detail-item">
        <span class="detail-label">User ID:</span>
        <span class="detail-value">${user.id}</span>
      </div>
    </div>
  `;

  const usernameToggle = document.getElementById('welcome-username');
  if (usernameToggle) {
    usernameToggle.addEventListener('mouseover', () => {
      document.getElementById('user-details-panel').classList.add('visible');
      document.getElementById('user-info').classList.add('details-visible');
    });

    usernameToggle.addEventListener('mouseout', () => {
      document.getElementById('user-details-panel').classList.remove('visible');
      document.getElementById('user-info').classList.remove('details-visible');
    });
  }
}
// Display XP info
function displayXPInfo(transactions) {
  const container = document.getElementById('xp-info');
  if (!container) {
    console.error('XP info container not found');
    return;
  }

  if (!transactions || transactions.length === 0) {
    container.innerHTML = `
      <h2>XP Information</h2>
      <p>No XP data available</p>
    `;
    return;
  }

  // Calculate cumulative XP
  const totalXP = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const formattedXP = formatSize(totalXP); 

  // 1. Define XP thresholds and colors 
  const expertThreshold = 2500000; // 2.5 MB
  const proficientThreshold = 1000000; // 1.0 MB
  
  const expertColor = '#f59e0b';     // Vibrant Orange/Gold
  const proficientColor = '#ffffff';  // White

  const defaultColor = '#4f46e5';    // Purple (same as graph bars)

  // 2. Determine the color based on total XP
  let xpColor = defaultColor;
  if (totalXP >= expertThreshold) {
    xpColor = expertColor;
  } else if (totalXP >= proficientThreshold) {
    xpColor = proficientColor;
  }

  // 3. Update the HTML to include the new colorful display
  container.innerHTML = `
       <h2>Total XP</h2>
    <div class="xp-display">
      <div class="xp-total-box" style="background: ${xpColor}">
        ${formattedXP}
      </div>
    </div>
    
  `;

  // Store cumulative XP data for graphing
  window.xpData = transactions;

  // Generate the XP graph
  generateXPGraph();
}


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
  tooltip.style.background = 'white';
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
    
  } else {
    document.getElementById('login-page').style.display = 'block';
  }
});

 

export function formatSize(bytes) {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const KILOBYTE = 1000;
  const MEGABYTE = 1000 * KILOBYTE;
  const GIGABYTE = 1000 * MEGABYTE;

  if (bytes >= GIGABYTE) {
    return `${(bytes / GIGABYTE).toFixed(2)} GB`;
  } else if (bytes >= MEGABYTE) {
    return `${(bytes / MEGABYTE).toFixed(2)} MB`;
  } else if (bytes >= KILOBYTE) {
    return `${(bytes / KILOBYTE).toFixed(1)} KB`; 
  } else {
    return `${bytes} Bytes`;
  }
}
 export function opt(xp) {
  if (xp < 1000) {
      return xp + " Bytes";
  }
  let mbs = xp / 1000;
  if (mbs < 1000) {
      return mbs.toFixed(2) + " KB";
  }
  let gbs = mbs / 1000;
  if (gbs < 1000) {
      return gbs.toFixed(2) + " MB";
  }
  let tbs = gbs / 1000;
  return tbs.toFixed(2) + " GB";
}
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
    } catch (error) {
      showError('Error fetching data: ' + error.message);
    }
  }
  
  // Execute GraphQL query
  async function executeGraphQLQuery(query, token) {
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
  
    document.getElementById('progress-info').innerHTML = `
      <h2>Progress Information</h2>
      <p><strong>Completed Projects:</strong> ${totalProjects}</p>
      <p><strong>Latest Project:</strong> ${progress[0]?.path || 'None'}</p>
    `;
  
    // Store data for graphs
    window.progressData = progress;
    generateProjectsGraph();
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
    path.setAttribute('stroke', '#4299e1');
    path.setAttribute('stroke-width', '2');
    svg.appendChild(path);
  
    // Add axes
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', padding);
    xAxis.setAttribute('y1', height - padding);
    xAxis.setAttribute('x2', width - padding);
    xAxis.setAttribute('y2', height - padding);
    xAxis.setAttribute('stroke', 'black');
    svg.appendChild(xAxis);
  
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', padding);
    yAxis.setAttribute('y1', padding);
    yAxis.setAttribute('x2', padding);
    yAxis.setAttribute('y2', height - padding);
    yAxis.setAttribute('stroke', 'black');
    svg.appendChild(yAxis);
  
    // Add labels
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', width / 2);
    title.setAttribute('y', 25);
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('font-weight', 'bold');
    title.textContent = 'XP Earned Over Time';
    svg.appendChild(title);
  
    const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xLabel.setAttribute('x', width / 2);
    xLabel.setAttribute('y', height - 10);
    xLabel.setAttribute('text-anchor', 'middle');
    xLabel.textContent = 'Date';
    svg.appendChild(xLabel);
  
    const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yLabel.setAttribute('x', -height / 2);
    yLabel.setAttribute('y', 15);
    yLabel.setAttribute('text-anchor', 'middle');
    yLabel.setAttribute('transform', 'rotate(-90)');
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
    xAxis.setAttribute('stroke', 'black');
    svg.appendChild(xAxis);
  
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', padding);
    yAxis.setAttribute('y1', padding);
    yAxis.setAttribute('x2', padding);
    yAxis.setAttribute('y2', height - padding);
    yAxis.setAttribute('stroke', 'black');
    svg.appendChild(yAxis);
  
    // Add title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', width / 2);
    title.setAttribute('y', 25);
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('font-weight', 'bold');
    title.textContent = 'Projects Completed by Category';
    svg.appendChild(title);
  
    document.getElementById('projects-graph').innerHTML = '';
    document.getElementById('projects-graph').appendChild(svg);
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
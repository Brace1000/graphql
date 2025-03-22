// progress.js

// Fetch progress data
export async function fetchProgressData(token) {
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
    return progressData.data.progress;
  }
  
  // Display progress info
  export function displayProgressInfo(progress) {
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
  
  // Generate projects graph
  export function generateProjectsGraph() {
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
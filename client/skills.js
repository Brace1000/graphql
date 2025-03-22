// Fetch skill data from GraphQL API

import { executeGraphQLQuery } from './main.js';
export async function fetchSkillData(token) {
    const skillQuery = `{
      user {
        id
        login
        skills: transactions(where: { type: { _like: "skill%" } }, order_by: [{ amount: desc }]) {
          type
          amount
        }
      }
    }`;
    
    const skillData = await executeGraphQLQuery(skillQuery, token);
    console.log('Skill Query:', skillQuery);
    console.log('Skill Data Response:', JSON.stringify(skillData, null, 2));
    
    // Check if user data exists and has skills
    if (skillData?.data?.user && skillData.data.user.length > 0) {
      return skillData.data.user[0].skills || [];
    }
    
    return [];
  }
  
  // Extract clean skill name from skill type string
  function extractSkillName(skillType) {
    // Remove "skill_" prefix and format skill name
    const skill = skillType.replace(/^skill_/, '');
    
    // Format skill names for better display
    const skillNameMap = {
      'go': 'Go',
      'back': 'Back-end',
      'front': 'Front-end',
      'js': 'JavaScript',
      'html': 'HTML',
      'css': 'CSS',
      'sql': 'SQL',
      'unix': 'Linux',
      'docker': 'Docker',
      'git': 'Git'
    };
    
    return skillNameMap[skill] || skill.charAt(0).toUpperCase() + skill.slice(1);
  }
  
  // Get top skills from transactions data
  export function getTopSkills(skills, limit = 4) {
    // Filter skills and handle duplicates to get highest value
    const skillMap = new Map();
    
    skills.forEach(skill => {
      if (skill.type.startsWith('skill_')) {
        const name = extractSkillName(skill.type);
        if (!skillMap.has(name) || skill.amount > skillMap.get(name).amount) {
          skillMap.set(name, {
            name,
            amount: skill.amount
          });
        }
      }
    });
    
    // Convert to array, sort by amount, and take top skills
    return Array.from(skillMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);
  }
  
  // Create SVG circle with progress indicator
  function createSkillCircle(skill) {
    // Create SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100');
    svg.setAttribute('height', '100');
    svg.setAttribute('viewBox', '0 0 100 100');
    
    // Constants for circle
    const centerX = 50;
    const centerY = 50;
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    
    // Background circle (dark)
    const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('cx', centerX);
    bgCircle.setAttribute('cy', centerY);
    bgCircle.setAttribute('r', radius);
    bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', '#333');
    bgCircle.setAttribute('stroke-width', '8');
    svg.appendChild(bgCircle);
    
    // Progress circle (indigo/purple)
    const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progressCircle.setAttribute('cx', centerX);
    progressCircle.setAttribute('cy', centerY);
    progressCircle.setAttribute('r', radius);
    progressCircle.setAttribute('fill', 'none');
    progressCircle.setAttribute('stroke', '#6366f1');
    progressCircle.setAttribute('stroke-width', '8');
    progressCircle.setAttribute('stroke-dasharray', circumference.toString());
    
    // Calculate stroke dash offset based on percentage
    const offset = circumference - (skill.amount / 100) * circumference;
    progressCircle.setAttribute('stroke-dashoffset', offset.toString());
    
    // Rotate to start from top
    progressCircle.setAttribute('transform', `rotate(-90 ${centerX} ${centerY})`);
    
    svg.appendChild(progressCircle);
    
    // Percentage text in center
    const percentText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    percentText.setAttribute('x', centerX);
    percentText.setAttribute('y', centerY);
    percentText.setAttribute('text-anchor', 'middle');
    percentText.setAttribute('dominant-baseline', 'middle');
    percentText.setAttribute('font-size', '16');
    percentText.setAttribute('font-weight', 'bold');
    percentText.setAttribute('fill', '#fff');
    percentText.textContent = `${Math.round(skill.amount)}%`;
    
    svg.appendChild(percentText);
    
    return svg;
  }
  
  // Display skill information section
  export function displaySkillInfo(skills) {
    const container = document.getElementById('skills-container');
    if (!container) {
      console.error('Skills container not found');
      return;
    }
    
    // Clear loading message
    container.innerHTML = '';
    
    if (!skills || skills.length === 0) {
      container.innerHTML = '<p>No skills data available</p>';
      return;
    }
    
    // Create skills section wrapper
    const skillsSection = document.createElement('div');
    skillsSection.className = 'skills-section';
    
    // Create header with title and "See more" link
    const header = document.createElement('div');
    header.className = 'section-header';
    
    const title = document.createElement('h3');
    title.textContent = 'Best skills';
    header.appendChild(title);
    
    const seeMoreLink = document.createElement('a');
    seeMoreLink.href = '#';
    seeMoreLink.textContent = 'See more';
    seeMoreLink.className = 'see-more';
    header.appendChild(seeMoreLink);
    
    skillsSection.appendChild(header);
    
    // Add description
    const description = document.createElement('p');
    description.className = 'section-description';
    description.textContent = 'Here are your skills with the highest completion rate among all categories.';
    skillsSection.appendChild(description);
    
    // Create skills grid
    const skillsGrid = document.createElement('div');
    skillsGrid.className = 'skills-grid';
    
    // Get top skills and create skill items
    const topSkills = getTopSkills(skills);
    
    topSkills.forEach(skill => {
      const skillItem = document.createElement('div');
      skillItem.className = 'skill-item';
      
      // Add skill circle
      const circle = createSkillCircle(skill);
      skillItem.appendChild(circle);
      
      // Add skill name
      const skillName = document.createElement('div');
      skillName.className = 'skill-name';
      skillName.textContent = skill.name;
      skillItem.appendChild(skillName);
      
      skillsGrid.appendChild(skillItem);
    });
    
    skillsSection.appendChild(skillsGrid);
    container.appendChild(skillsSection);
    
    // Add styles
    addSkillStyles();
  }
  
  // Add required CSS styles
  function addSkillStyles() {
    // Check if styles already exist
    if (document.getElementById('skill-styles')) {
      return;
    }
    
    const styleElement = document.createElement('style');
    styleElement.id = 'skill-styles';
    styleElement.textContent = `
      .skills-section {
        background-color: #1e1e1e;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
        color: #fff;
      }
      
      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }
      
      .section-header h3 {
        margin: 0;
        font-size: 1.5rem;
      }
      
      .see-more {
        color: #6366f1;
        text-decoration: none;
      }
      
      .section-description {
        color: #aaa;
        margin-bottom: 20px;
      }
      
      .skills-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 20px;
      }
      
      .skill-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }
      
      .skill-name {
        font-weight: 500;
        text-align: center;
      }
    `;
    
    document.head.appendChild(styleElement);
  }
  
  // Main initialization function
  export function initializeSkillsDisplay(token) {
    return fetchSkillData(token)
      .then(skills => {
        displaySkillInfo(skills);
        return skills;
      })
      .catch(error => {
        console.error('Error initializing skills display:', error);
        const container = document.getElementById('skills-container');
        if (container) {
          container.innerHTML = '<p class="error">Failed to load skills data</p>';
        }
      });
  }
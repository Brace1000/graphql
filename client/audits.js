// Fetch audit data
export async function fetchAuditData(token) {
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
  return auditData.data.user[0].audits || [];
}

// Display audit info
export function displayAuditInfo(audits) {
  const auditsDone = audits.filter((audit) => audit.closureType === 'succeeded').length;
  const auditsReceived = audits.filter((audit) =>
    ['expired', 'unused', 'failed', 'autoFailed', 'canceled', 'invalidated', 'reassigned'].includes(audit.closureType)
  ).length;

  const auditRatio = auditsReceived === 0 ? 0 : (auditsDone / auditsReceived).toFixed(1);

  document.getElementById('audit-info').innerHTML = `
    <h2>Audit Ratio</h2>
    <p><strong>Audit Ratio:</strong> ${auditRatio}</p>
  `;
}
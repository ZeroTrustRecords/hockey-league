const TEAM_ABBREVIATIONS = {
  Canadiens: 'MTL',
  Bruins: 'BOS',
  Rangers: 'NYR',
  Flyers: 'PHI',
  Stars: 'DAL',
  Blues: 'STL',
};

export function getTeamAbbreviation(teamName) {
  return TEAM_ABBREVIATIONS[teamName] || teamName || '';
}

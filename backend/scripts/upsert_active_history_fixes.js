const fs = require('fs');
const path = require('path');

const FIXTURE_PATH = path.join(__dirname, '..', 'data', 'historical-season-stats.json');

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
}

function statRow(firstName, lastName, position, teamName, gamesPlayed, goals, assists, points, pim = 0, statType = 'regular') {
  return {
    first_name: firstName,
    last_name: lastName,
    team_name: teamName,
    position,
    games_played: gamesPlayed,
    goals,
    assists,
    points,
    pim,
    avg_points: gamesPlayed > 0 ? (points / gamesPlayed).toFixed(2).replace('.', ',') : '0,00',
    plus_minus: 0,
    shots: 0,
    historical_seasons_count: 1,
    stat_type: statType,
  };
}

const corrections = [
  {
    name: ['Alexandre', 'Plante'],
    position: 'A',
    seasons: {
      'ÉTÉ - 2018': [
        statRow('Alexandre', 'Plante', 'A', 'Blues', 15, 29, 9, 38),
        statRow('Alexandre', 'Plante', 'A', 'Blues', 1, 1, 2, 3, 0, 'playoffs'),
      ],
      'ÉTÉ - 2019': [statRow('Alexandre', 'Plante', 'A', 'Flyers', 14, 16, 21, 37)],
      'ÉTÉ - 2020': [statRow('Alexandre', 'Plante', 'A', 'Canadiens', 5, 6, 12, 18)],
      'ÉTÉ - 2021': [
        statRow('Alexandre', 'Plante', 'A', 'Stars', 5, 6, 7, 13),
        statRow('Alexandre', 'Plante', 'A', 'Stars', 2, 5, 2, 7, 0, 'playoffs'),
      ],
      'ÉTÉ - 2022': [
        statRow('Alexandre', 'Plante', 'A', 'Canadiens', 11, 17, 16, 33),
        statRow('Alexandre', 'Plante', 'A', 'Canadiens', 2, 3, 3, 6, 0, 'playoffs'),
      ],
      'ÉTÉ - 2023': [
        statRow('Alexandre', 'Plante', 'A', 'Canadiens', 15, 16, 20, 36),
        statRow('Alexandre', 'Plante', 'A', 'Canadiens', 3, 3, 0, 3, 0, 'playoffs'),
      ],
      'ÉTÉ - 2024': [statRow('Alexandre', 'Plante', 'A', 'Stars', 17, 20, 21, 41)],
      'ÉTÉ - 2025': [
        statRow('Alexandre', 'Plante', 'A', 'Stars', 14, 18, 18, 36),
        statRow('Alexandre', 'Plante', 'A', 'Stars', 3, 9, 5, 14, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Benoit', 'Laplante'],
    position: 'D',
    seasons: {
      'ÉTÉ - 2023': [
        statRow('Benoit', 'Laplante', 'D', 'Bruins', 15, 4, 7, 11, 4),
        statRow('Benoit', 'Laplante', 'D', 'Bruins', 3, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2024': [statRow('Benoit', 'Laplante', 'D', 'Flyers', 14, 1, 4, 5, 2)],
      'ÉTÉ - 2025': [
        statRow('Benoit', 'Laplante', 'D', 'Canadiens', 13, 1, 4, 5, 6),
        statRow('Benoit', 'Laplante', 'D', 'Canadiens', 3, 0, 0, 0, 2, 'playoffs'),
      ],
    },
  },
  {
    name: ['Benoit', 'Tremblay'],
    position: 'G',
    seasons: {
      'ÉTÉ - 2018': [statRow('Benoit', 'Tremblay', 'G', 'Blues', 10, 0, 0, 0)],
      'ÉTÉ - 2019': [statRow('Benoit', 'Tremblay', 'G', 'Flyers', 15, 0, 1, 1)],
      'ÉTÉ - 2020': [statRow('Benoit', 'Tremblay', 'G', 'Canadiens', 5, 0, 0, 0)],
      'ÉTÉ - 2021': [
        statRow('Benoit', 'Tremblay', 'G', 'Rangers', 4, 0, 0, 0),
        statRow('Benoit', 'Tremblay', 'G', 'Rangers', 2, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2022': [
        statRow('Benoit', 'Tremblay', 'G', 'Bruins', 13, 0, 0, 0),
        statRow('Benoit', 'Tremblay', 'G', 'Bruins', 2, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2023': [
        statRow('Benoit', 'Tremblay', 'G', 'Blues', 14, 0, 0, 0),
        statRow('Benoit', 'Tremblay', 'G', 'Blues', 2, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2024': [statRow('Benoit', 'Tremblay', 'G', 'Stars', 17, 0, 0, 0)],
      'ÉTÉ - 2025': [
        statRow('Benoit', 'Tremblay', 'G', 'Stars', 15, 0, 0, 0),
        statRow('Benoit', 'Tremblay', 'G', 'Stars', 3, 0, 0, 0, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Bruno', 'Labrecque'],
    position: 'A',
    seasons: {
      'ÉTÉ - 2019': [statRow('Bruno', 'Labrecque', 'A', 'Flyers', 10, 3, 7, 10)],
      'ÉTÉ - 2021': [
        statRow('Bruno', 'Labrecque', 'A', 'Stars', 3, 0, 1, 1),
        statRow('Bruno', 'Labrecque', 'A', 'Stars', 2, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2022': [
        statRow('Bruno', 'Labrecque', 'A', 'Rangers', 10, 4, 6, 10),
        statRow('Bruno', 'Labrecque', 'A', 'Rangers', 1, 0, 1, 1, 0, 'playoffs'),
      ],
      'ÉTÉ - 2023': [
        statRow('Bruno', 'Labrecque', 'A', 'Bruins', 12, 3, 6, 9),
        statRow('Bruno', 'Labrecque', 'A', 'Bruins', 2, 0, 0, 0, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Bruno', 'Poulin'],
    position: 'D',
    seasons: {
      'ÉTÉ - 2018': [statRow('Bruno', 'Poulin', 'D', 'Rangers', 1, 0, 0, 0)],
      'ÉTÉ - 2019': [statRow('Bruno', 'Poulin', 'D', 'Rangers', 14, 1, 0, 1, 2)],
      'ÉTÉ - 2021': [
        statRow('Bruno', 'Poulin', 'D', 'Stars', 4, 1, 1, 2),
        statRow('Bruno', 'Poulin', 'D', 'Stars', 2, 1, 0, 1, 0, 'playoffs'),
      ],
      'ÉTÉ - 2022': [statRow('Bruno', 'Poulin', 'D', 'Canadiens / Rangers', 2, 0, 1, 1, 2)],
      'ÉTÉ - 2023': [
        statRow('Bruno', 'Poulin', 'D', 'Bruins', 11, 0, 2, 2),
        statRow('Bruno', 'Poulin', 'D', 'Bruins', 3, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2024': [statRow('Bruno', 'Poulin', 'D', 'Rangers', 16, 3, 3, 6, 6)],
      'ÉTÉ - 2025': [
        statRow('Bruno', 'Poulin', 'D', 'Canadiens', 11, 0, 5, 5, 8),
        statRow('Bruno', 'Poulin', 'D', 'Canadiens', 2, 0, 0, 0, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Daomi', 'Rousseau'],
    position: 'D',
    seasons: {
      'ÉTÉ - 2025': [
        statRow('Daomi', 'Rousseau', 'D', 'Bruins', 7, 2, 2, 4, 2),
        statRow('Daomi', 'Rousseau', 'D', 'Bruins', 2, 0, 0, 0, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Éric', 'Bertrand'],
    aliases: [['Eric', 'Bertrand']],
    position: 'A',
    seasons: {
      'ÉTÉ - 2025': [
        statRow('Éric', 'Bertrand', 'A', 'Stars', 12, 11, 7, 18, 4),
        statRow('Éric', 'Bertrand', 'A', 'Stars', 3, 1, 1, 2, 4, 'playoffs'),
      ],
    },
  },
  {
    name: ['Éric', 'De Sousa'],
    aliases: [['Eric', 'De Sousa']],
    position: 'G',
    seasons: {
      'ÉTÉ - 2019': [statRow('Éric', 'De Sousa', 'G', 'Bruins', 12, 0, 1, 1)],
      'ÉTÉ - 2020': [statRow('Éric', 'De Sousa', 'G', 'Flyers', 4, 0, 0, 0)],
      'ÉTÉ - 2021': [
        statRow('Éric', 'De Sousa', 'G', 'Canadiens', 5, 0, 0, 0),
        statRow('Éric', 'De Sousa', 'G', 'Canadiens', 2, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2022': [
        statRow('Éric', 'De Sousa', 'G', 'Stars', 11, 0, 0, 0),
        statRow('Éric', 'De Sousa', 'G', 'Stars', 1, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2023': [
        statRow('Éric', 'De Sousa', 'G', 'Flyers', 13, 0, 0, 0, 4),
        statRow('Éric', 'De Sousa', 'G', 'Flyers', 3, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2024': [statRow('Éric', 'De Sousa', 'G', 'Canadiens', 16, 0, 0, 0)],
      'ÉTÉ - 2025': [
        statRow('Éric', 'De Sousa', 'G', 'Bruins', 13, 0, 0, 0),
        statRow('Éric', 'De Sousa', 'G', 'Bruins', 3, 0, 0, 0, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['François', 'Noël'],
    aliases: [['Francois', 'Noel'], ['Fran?ois', 'No?l']],
    position: 'D',
    seasons: {
      'ÉTÉ - 2020': [statRow('François', 'Noël', 'D', 'Stars', 4, 3, 5, 8)],
      'ÉTÉ - 2021': [
        statRow('François', 'Noël', 'D', 'Rangers', 3, 1, 1, 2, 2),
        statRow('François', 'Noël', 'D', 'Rangers', 1, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2022': [
        statRow('François', 'Noël', 'D', 'Canadiens / Rangers', 6, 0, 1, 1),
        statRow('François', 'Noël', 'D', 'Canadiens', 1, 0, 4, 4, 0, 'playoffs'),
      ],
      'ÉTÉ - 2023': [
        statRow('François', 'Noël', 'D', 'Canadiens', 14, 3, 10, 13),
        statRow('François', 'Noël', 'D', 'Canadiens', 1, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2024': [statRow('François', 'Noël', 'D', 'Blues', 12, 0, 11, 11, 12)],
      'ÉTÉ - 2025': [
        statRow('François', 'Noël', 'D', 'Stars', 10, 2, 4, 6, 10),
        statRow('François', 'Noël', 'D', 'Stars', 2, 0, 2, 2, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Fred', 'Yergeau'],
    aliases: [['Frederic', 'Yergeau'], ['Frédéric', 'Yergeau']],
    position: 'D',
    seasons: {
      'ÉTÉ - 2018': [statRow('Fred', 'Yergeau', 'D', 'Blues', 12, 0, 7, 7)],
      'ÉTÉ - 2019': [statRow('Fred', 'Yergeau', 'D', 'Stars', 13, 1, 4, 5, 8)],
      'ÉTÉ - 2020': [statRow('Fred', 'Yergeau', 'D', 'Stars', 5, 3, 2, 5)],
      'ÉTÉ - 2021': [
        statRow('Fred', 'Yergeau', 'D', 'Rangers', 5, 1, 2, 3, 2),
        statRow('Fred', 'Yergeau', 'D', 'Rangers', 2, 0, 1, 1, 2, 'playoffs'),
      ],
      'ÉTÉ - 2022': [
        statRow('Fred', 'Yergeau', 'D', 'Canadiens', 11, 3, 8, 11),
        statRow('Fred', 'Yergeau', 'D', 'Canadiens', 1, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2023': [
        statRow('Fred', 'Yergeau', 'D', 'Stars', 14, 2, 7, 9, 8),
        statRow('Fred', 'Yergeau', 'D', 'Stars', 3, 0, 1, 1, 0, 'playoffs'),
      ],
      'ÉTÉ - 2024': [statRow('Fred', 'Yergeau', 'D', 'Blues', 12, 0, 7, 7, 2)],
      'ÉTÉ - 2025': [
        statRow('Fred', 'Yergeau', 'D', 'Flyers', 13, 0, 4, 4, 8),
        statRow('Fred', 'Yergeau', 'D', 'Flyers', 3, 0, 0, 0, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Ghislain', 'Mathieu'],
    position: 'G',
    seasons: {
      'ÉTÉ - 2018': [
        statRow('Ghislain', 'Mathieu', 'G', 'Flyers', 15, 0, 0, 0),
        statRow('Ghislain', 'Mathieu', 'G', 'Flyers', 2, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2019': [statRow('Ghislain', 'Mathieu', 'G', 'Rangers', 15, 0, 1, 1)],
      'ÉTÉ - 2020': [statRow('Ghislain', 'Mathieu', 'G', 'Rangers', 4, 0, 0, 0)],
      'ÉTÉ - 2021': [
        statRow('Ghislain', 'Mathieu', 'G', 'Bruins', 4, 0, 1, 1),
        statRow('Ghislain', 'Mathieu', 'G', 'Bruins', 2, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2022': [
        statRow('Ghislain', 'Mathieu', 'G', 'Rangers', 10, 0, 0, 0),
        statRow('Ghislain', 'Mathieu', 'G', 'Rangers', 2, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2023': [
        statRow('Ghislain', 'Mathieu', 'G', 'Rangers', 13, 0, 0, 0),
        statRow('Ghislain', 'Mathieu', 'G', 'Rangers', 3, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2024': [statRow('Ghislain', 'Mathieu', 'G', 'Flyers', 16, 0, 0, 0)],
      'ÉTÉ - 2025': [
        statRow('Ghislain', 'Mathieu', 'G', 'Flyers', 13, 0, 1, 1),
        statRow('Ghislain', 'Mathieu', 'G', 'Flyers', 3, 0, 0, 0, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Jean Christophe', 'Dubé'],
    aliases: [['Jean Christophe', 'Dub?']],
    position: 'A',
    seasons: {
      'ÉTÉ - 2018': [
        statRow('Jean Christophe', 'Dubé', 'A', 'Flyers', 12, 11, 11, 22),
        statRow('Jean Christophe', 'Dubé', 'A', 'Flyers', 2, 3, 0, 3, 0, 'playoffs'),
      ],
      'ÉTÉ - 2019': [statRow('Jean Christophe', 'Dubé', 'A', 'Stars', 8, 9, 12, 21)],
      'ÉTÉ - 2020': [statRow('Jean Christophe', 'Dubé', 'A', 'Rangers', 4, 9, 2, 11)],
      'ÉTÉ - 2021': [statRow('Jean Christophe', 'Dubé', 'A', 'Blues', 2, 0, 1, 1)],
      'ÉTÉ - 2022': [
        statRow('Jean Christophe', 'Dubé', 'A', 'Blues', 11, 7, 8, 15),
        statRow('Jean Christophe', 'Dubé', 'A', 'Blues', 2, 1, 0, 1, 0, 'playoffs'),
      ],
      'ÉTÉ - 2023': [
        statRow('Jean Christophe', 'Dubé', 'A', 'Stars', 8, 7, 2, 9),
        statRow('Jean Christophe', 'Dubé', 'A', 'Stars', 2, 1, 0, 1, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Jean Marc', 'Lebouthillier'],
    aliases: [['Jean', 'Marc Lebouthillier']],
    position: 'A',
    seasons: {
      'ÉTÉ - 2018': [
        statRow('Jean Marc', 'Lebouthillier', 'A', 'Rangers', 10, 10, 18, 28, 2),
        statRow('Jean Marc', 'Lebouthillier', 'A', 'Rangers', 2, 0, 6, 6, 0, 'playoffs'),
      ],
      'ÉTÉ - 2019': [statRow('Jean Marc', 'Lebouthillier', 'A', 'Bruins', 10, 4, 22, 26, 6)],
      'ÉTÉ - 2021': [
        statRow('Jean Marc', 'Lebouthillier', 'A', 'Stars', 4, 4, 6, 10),
        statRow('Jean Marc', 'Lebouthillier', 'A', 'Stars', 1, 1, 0, 1, 0, 'playoffs'),
      ],
      'ÉTÉ - 2022': [
        statRow('Jean Marc', 'Lebouthillier', 'A', 'Rangers', 8, 7, 9, 16),
        statRow('Jean Marc', 'Lebouthillier', 'A', 'Rangers', 2, 3, 3, 6, 0, 'playoffs'),
      ],
      'ÉTÉ - 2023': [
        statRow('Jean Marc', 'Lebouthillier', 'A', 'Bruins', 10, 9, 11, 20, 2),
        statRow('Jean Marc', 'Lebouthillier', 'A', 'Bruins', 3, 6, 1, 7, 0, 'playoffs'),
      ],
      'ÉTÉ - 2024': [statRow('Jean Marc', 'Lebouthillier', 'A', 'Rangers', 17, 11, 19, 30)],
      'ÉTÉ - 2025': [
        statRow('Jean Marc', 'Lebouthillier', 'A', 'Rangers', 14, 11, 27, 38, 2),
        statRow('Jean Marc', 'Lebouthillier', 'A', 'Rangers', 2, 0, 0, 0, 2, 'playoffs'),
      ],
    },
  },
  {
    name: ['Jean-Philippe', 'Perreault'],
    aliases: [['Jean Philippe', 'Perreault']],
    position: 'G',
    seasons: {
      'ÉTÉ - 2024': [statRow('Jean-Philippe', 'Perreault', 'G', 'Blues', 17, 0, 0, 0)],
      'ÉTÉ - 2025': [
        statRow('Jean-Philippe', 'Perreault', 'G', 'Canadiens', 12, 0, 0, 0),
        statRow('Jean-Philippe', 'Perreault', 'G', 'Canadiens', 3, 0, 0, 0, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Jocelyn', 'Mathieu'],
    position: 'D',
    seasons: {
      'ÉTÉ - 2018': [
        statRow('Jocelyn', 'Mathieu', 'D', 'Flyers', 12, 1, 4, 5),
        statRow('Jocelyn', 'Mathieu', 'D', 'Flyers', 2, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2019': [statRow('Jocelyn', 'Mathieu', 'D', 'Canadiens', 13, 0, 5, 5, 2)],
      'ÉTÉ - 2022': [
        statRow('Jocelyn', 'Mathieu', 'D', 'Blues', 9, 0, 2, 2, 4),
        statRow('Jocelyn', 'Mathieu', 'D', 'Blues', 1, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2023': [
        statRow('Jocelyn', 'Mathieu', 'D', 'Rangers', 12, 1, 4, 5, 2),
        statRow('Jocelyn', 'Mathieu', 'D', 'Rangers', 3, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2024': [statRow('Jocelyn', 'Mathieu', 'D', 'Blues', 17, 0, 4, 4, 6)],
      'ÉTÉ - 2025': [
        statRow('Jocelyn', 'Mathieu', 'D', 'Rangers', 12, 1, 3, 4),
        statRow('Jocelyn', 'Mathieu', 'D', 'Rangers', 2, 2, 0, 2, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Juan', 'Bolivar'],
    aliases: [['x', 'Bolivar']],
    position: 'D',
    seasons: {
      'ÉTÉ - 2024': [statRow('Juan', 'Bolivar', 'D', 'Prédateurs', 15, 0, 14, 14, 10)],
      'ÉTÉ - 2025': [
        statRow('Juan', 'Bolivar', 'D', 'Flyers', 11, 5, 8, 13, 10),
        statRow('Juan', 'Bolivar', 'D', 'Flyers', 2, 1, 1, 2, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Julien', 'Lacerte'],
    position: 'D',
    seasons: {
      'ÉTÉ - 2020': [statRow('Julien', 'Lacerte', 'D', 'Flyers', 4, 1, 3, 4)],
      'ÉTÉ - 2021': [
        statRow('Julien', 'Lacerte', 'D', 'Canadiens', 3, 2, 0, 2),
        statRow('Julien', 'Lacerte', 'D', 'Canadiens', 2, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2022': [
        statRow('Julien', 'Lacerte', 'D', 'Flyers', 8, 0, 4, 4),
        statRow('Julien', 'Lacerte', 'D', 'Flyers', 2, 0, 1, 1, 0, 'playoffs'),
      ],
      'ÉTÉ - 2024': [statRow('Julien', 'Lacerte', 'D', 'Rangers', 16, 1, 4, 5, 6)],
      'ÉTÉ - 2025': [
        statRow('Julien', 'Lacerte', 'D', 'Blues', 9, 2, 6, 8, 10),
        statRow('Julien', 'Lacerte', 'D', 'Blues', 1, 0, 3, 3, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Malick', 'Plante-Girard'],
    aliases: [['Malick', 'Plante Girard']],
    position: 'A',
    seasons: {
      'ÉTÉ - 2025': [
        statRow('Malick', 'Plante-Girard', 'A', 'Flyers', 14, 3, 6, 9, 11),
        statRow('Malick', 'Plante-Girard', 'A', 'Flyers', 3, 3, 0, 3, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Marc Alexandre', 'Paradis'],
    aliases: [['Marc', 'Alexandre Paradis'], ['M-A', 'Paradis']],
    position: 'A',
    seasons: {
      'ÉTÉ - 2019': [statRow('Marc Alexandre', 'Paradis', 'A', 'Blues', 10, 2, 5, 7, 12)],
      'ÉTÉ - 2020': [statRow('Marc Alexandre', 'Paradis', 'A', 'Blues', 5, 3, 7, 10)],
      'ÉTÉ - 2021': [
        statRow('Marc Alexandre', 'Paradis', 'A', 'Blues', 2, 1, 2, 3, 6),
        statRow('Marc Alexandre', 'Paradis', 'A', 'Blues', 1, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2022': [
        statRow('Marc Alexandre', 'Paradis', 'A', 'Rangers', 8, 1, 7, 8),
        statRow('Marc Alexandre', 'Paradis', 'A', 'Rangers', 1, 0, 1, 1, 0, 'playoffs'),
      ],
      'ÉTÉ - 2023': [
        statRow('Marc Alexandre', 'Paradis', 'A', 'Rangers', 11, 3, 4, 7, 4),
        statRow('Marc Alexandre', 'Paradis', 'A', 'Rangers', 2, 1, 0, 1, 0, 'playoffs'),
      ],
      'ÉTÉ - 2024': [statRow('Marc Alexandre', 'Paradis', 'A', 'Blues', 9, 1, 5, 6, 4)],
      'ÉTÉ - 2025': [
        statRow('Marc Alexandre', 'Paradis', 'A', 'Blues', 9, 2, 2, 4, 6),
        statRow('Marc Alexandre', 'Paradis', 'A', 'Blues', 3, 0, 1, 1, 4, 'playoffs'),
      ],
    },
  },
  {
    name: ['Marc Antoine', 'Aylwin'],
    aliases: [['Marc', 'Antoine Aylwin']],
    position: 'A',
    seasons: {
      'ÉTÉ - 2022': [
        statRow('Marc Antoine', 'Aylwin', 'A', 'Canadiens', 12, 0, 0, 0),
        statRow('Marc Antoine', 'Aylwin', 'A', 'Canadiens', 2, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2023': [
        statRow('Marc Antoine', 'Aylwin', 'A', 'Canadiens', 14, 8, 9, 17, 4),
        statRow('Marc Antoine', 'Aylwin', 'A', 'Canadiens', 2, 1, 0, 1, 0, 'playoffs'),
      ],
      'ÉTÉ - 2024': [statRow('Marc Antoine', 'Aylwin', 'A', 'Canadiens', 14, 4, 7, 11, 8)],
      'ÉTÉ - 2025': [
        statRow('Marc Antoine', 'Aylwin', 'A', 'Flyers', 15, 8, 16, 24, 10),
        statRow('Marc Antoine', 'Aylwin', 'A', 'Flyers', 3, 2, 4, 6, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Marc-André', 'Lebel'],
    aliases: [['Marc-Andr?', 'Lebel'], ['Marc Andre', 'Lebel']],
    position: 'D',
    seasons: {
      'ÉTÉ - 2024': [statRow('Marc-André', 'Lebel', 'D', 'Flyers', 15, 3, 12, 15, 14)],
      'ÉTÉ - 2025': [
        statRow('Marc-André', 'Lebel', 'D', 'Stars', 12, 3, 3, 6, 10),
        statRow('Marc-André', 'Lebel', 'D', 'Stars', 2, 0, 2, 2, 2, 'playoffs'),
      ],
    },
  },
  {
    name: ['Martin', 'Tousignant'],
    position: 'D',
    seasons: {
      'ÉTÉ - 2018': [statRow('Martin', 'Tousignant', 'D', 'Flyers', 12, 4, 6, 10, 8)],
      'ÉTÉ - 2019': [statRow('Martin', 'Tousignant', 'D', 'Blues', 10, 1, 3, 4, 6)],
      'ÉTÉ - 2022': [statRow('Martin', 'Tousignant', 'D', 'Bruins', 11, 4, 6, 10, 2)],
    },
  },
  {
    name: ['Michael', 'McLean'],
    aliases: [['Michael', 'Mc lean']],
    position: 'G',
    seasons: {
      'ÉTÉ - 2020': [statRow('Michael', 'McLean', 'G', 'Bruins', 4, 0, 0, 0)],
      'ÉTÉ - 2021': [
        statRow('Michael', 'McLean', 'G', 'Blues', 5, 0, 0, 0),
        statRow('Michael', 'McLean', 'G', 'Blues', 2, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2022': [
        statRow('Michael', 'McLean', 'G', 'Blues', 8, 0, 1, 1),
        statRow('Michael', 'McLean', 'G', 'Blues', 2, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2023': [
        statRow('Michael', 'McLean', 'G', 'Stars', 7, 0, 0, 0),
        statRow('Michael', 'McLean', 'G', 'Stars', 3, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2024': [statRow('Michael', 'McLean', 'G', 'Prédateurs', 17, 0, 1, 1)],
      'ÉTÉ - 2025': [
        statRow('Michael', 'McLean', 'G', 'Rangers', 14, 0, 1, 1),
        statRow('Michael', 'McLean', 'G', 'Rangers', 3, 0, 0, 0, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Nicolas', 'Fortin'],
    position: 'A',
    seasons: {
      'ÉTÉ - 2024': [statRow('Nicolas', 'Fortin', 'A', 'Canadiens', 11, 1, 5, 6, 6)],
      'ÉTÉ - 2025': [
        statRow('Nicolas', 'Fortin', 'A', 'Bruins / Flyers', 9, 9, 3, 12, 4),
        statRow('Nicolas', 'Fortin', 'A', 'Bruins', 2, 1, 2, 3, 2, 'playoffs'),
      ],
    },
  },
  {
    name: ['Olivier', 'Duchesne'],
    position: 'A',
    seasons: {
      'ÉTÉ - 2024': [statRow('Olivier', 'Duchesne', 'A', 'Stars', 12, 9, 5, 14, 6)],
      'ÉTÉ - 2025': [
        statRow('Olivier', 'Duchesne', 'A', 'Bruins', 10, 6, 8, 14, 4),
        statRow('Olivier', 'Duchesne', 'A', 'Bruins', 1, 0, 1, 1, 2, 'playoffs'),
      ],
    },
  },
  {
    name: ['Patrick', 'Marcil'],
    position: 'G',
    seasons: {
      'ÉTÉ - 2023': [
        statRow('Patrick', 'Marcil', 'G', 'Bruins', 12, 0, 0, 0),
        statRow('Patrick', 'Marcil', 'G', 'Bruins', 3, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2024': [statRow('Patrick', 'Marcil', 'G', 'Rangers', 15, 0, 0, 0)],
      'ÉTÉ - 2025': [
        statRow('Patrick', 'Marcil', 'G', 'Blues', 11, 0, 1, 1),
        statRow('Patrick', 'Marcil', 'G', 'Blues', 2, 0, 0, 0, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Richard', 'Larouche'],
    position: 'D',
    seasons: {
      'ÉTÉ - 2018': [statRow('Richard', 'Larouche', 'D', 'Rangers', 3, 0, 1, 1)],
      'ÉTÉ - 2024': [statRow('Richard', 'Larouche', 'D', 'Rangers', 9, 1, 4, 5, 2)],
      'ÉTÉ - 2025': [
        statRow('Richard', 'Larouche', 'D', 'Bruins', 7, 0, 0, 0, 2),
        statRow('Richard', 'Larouche', 'D', 'Bruins', 3, 1, 2, 3, 2, 'playoffs'),
      ],
    },
  },
  {
    name: ['Roxanne', 'Beliveau'],
    aliases: [['Roxanne', 'Beliveaau'], ['Roxanne', 'Beliveau']],
    position: 'D',
    seasons: {
      'ÉTÉ - 2021': [
        statRow('Roxanne', 'Beliveau', 'D', 'Flyers', 4, 0, 0, 0, 4),
        statRow('Roxanne', 'Beliveau', 'D', 'Flyers', 2, 0, 1, 1, 0, 'playoffs'),
      ],
      'ÉTÉ - 2023': [statRow('Roxanne', 'Beliveau', 'D', 'Flyers', 9, 1, 4, 5, 2)],
      'ÉTÉ - 2024': [statRow('Roxanne', 'Beliveau', 'D', 'Flyers', 12, 3, 7, 10, 6)],
      'ÉTÉ - 2025': [statRow('Roxanne', 'Beliveau', 'D', 'Bruins', 4, 0, 4, 4, 4)],
    },
  },
  {
    name: ['Sébastien', 'Belhumeur'],
    aliases: [['S?bastien', 'Belhumeur']],
    position: 'D',
    seasons: {
      'ÉTÉ - 2021': [
        statRow('Sébastien', 'Belhumeur', 'D', 'Stars', 4, 5, 4, 9),
        statRow('Sébastien', 'Belhumeur', 'D', 'Stars', 2, 0, 2, 2, 0, 'playoffs'),
      ],
      'ÉTÉ - 2023': [
        statRow('Sébastien', 'Belhumeur', 'D', 'Rangers', 9, 1, 5, 6, 2),
        statRow('Sébastien', 'Belhumeur', 'D', 'Rangers', 3, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2024': [statRow('Sébastien', 'Belhumeur', 'D', 'Prédateurs', 18, 7, 8, 15, 6)],
      'ÉTÉ - 2025': [
        statRow('Sébastien', 'Belhumeur', 'D', 'Rangers', 13, 4, 9, 13, 2),
        statRow('Sébastien', 'Belhumeur', 'D', 'Rangers', 2, 0, 0, 0, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Sébastien', 'Cool'],
    aliases: [['S?bastien', 'Cool']],
    position: 'A',
    seasons: {
      'ÉTÉ - 2018': [
        statRow('Sébastien', 'Cool', 'A', 'Flyers', 12, 11, 10, 21, 4),
        statRow('Sébastien', 'Cool', 'A', 'Flyers', 2, 0, 2, 2, 2, 'playoffs'),
      ],
      'ÉTÉ - 2019': [statRow('Sébastien', 'Cool', 'A', 'Stars', 10, 9, 9, 18)],
      'ÉTÉ - 2020': [statRow('Sébastien', 'Cool', 'A', 'Bruins', 4, 3, 1, 4)],
      'ÉTÉ - 2021': [
        statRow('Sébastien', 'Cool', 'A', 'Canadiens', 3, 4, 2, 6),
        statRow('Sébastien', 'Cool', 'A', 'Canadiens', 1, 0, 1, 1, 0, 'playoffs'),
      ],
      'ÉTÉ - 2022': [
        statRow('Sébastien', 'Cool', 'A', 'Blues', 11, 9, 8, 17),
        statRow('Sébastien', 'Cool', 'A', 'Blues', 2, 1, 0, 1, 0, 'playoffs'),
      ],
      'ÉTÉ - 2023': [
        statRow('Sébastien', 'Cool', 'A', 'Stars', 9, 8, 7, 15, 2),
        statRow('Sébastien', 'Cool', 'A', 'Stars', 3, 0, 2, 2, 0, 'playoffs'),
      ],
      'ÉTÉ - 2024': [statRow('Sébastien', 'Cool', 'A', 'Rangers', 12, 4, 7, 11, 2)],
      'ÉTÉ - 2025': [
        statRow('Sébastien', 'Cool', 'A', 'Canadiens', 11, 6, 1, 7, 4),
        statRow('Sébastien', 'Cool', 'A', 'Canadiens', 3, 0, 0, 0, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Serge', 'Lauzon'],
    position: 'A',
    seasons: {
      'ÉTÉ - 2023': [
        statRow('Serge', 'Lauzon', 'A', 'Bruins', 14, 5, 8, 13, 2),
        statRow('Serge', 'Lauzon', 'A', 'Bruins', 3, 0, 0, 0, 0, 'playoffs'),
      ],
      'ÉTÉ - 2024': [statRow('Serge', 'Lauzon', 'A', 'Canadiens', 16, 3, 6, 9, 2)],
      'ÉTÉ - 2025': [
        statRow('Serge', 'Lauzon', 'A', 'Rangers', 13, 4, 4, 8),
        statRow('Serge', 'Lauzon', 'A', 'Rangers', 2, 1, 0, 1, 2, 'playoffs'),
      ],
    },
  },
  {
    name: ['Simon', 'Gaudreault'],
    position: 'D',
    seasons: {
      'ÉTÉ - 2024': [statRow('Simon', 'Gaudreault', 'D', 'Prédateurs', 14, 5, 13, 18, 10)],
      'ÉTÉ - 2025': [
        statRow('Simon', 'Gaudreault', 'D', 'Stars', 8, 3, 4, 7, 4),
        statRow('Simon', 'Gaudreault', 'D', 'Stars', 2, 0, 0, 0, 0, 'playoffs'),
      ],
    },
  },
  {
    name: ['Stéphane', 'Martin'],
    aliases: [['Stephane', 'Martin']],
    position: 'D',
    seasons: {
      'ÉTÉ - 2024': [statRow('Stéphane', 'Martin', 'D', 'Rangers', 14, 6, 8, 14, 6)],
      'ÉTÉ - 2025': [
        statRow('Stéphane', 'Martin', 'D', 'Canadiens', 14, 3, 8, 11, 2),
        statRow('Stéphane', 'Martin', 'D', 'Canadiens', 3, 4, 2, 6, 6, 'playoffs'),
      ],
    },
  },
  {
    name: ['Yannick', 'Peccia'],
    position: 'A',
    seasons: {
      'ÉTÉ - 2024': [statRow('Yannick', 'Peccia', 'A', 'Stars', 16, 9, 5, 14, 16)],
      'ÉTÉ - 2025': [
        statRow('Yannick', 'Peccia', 'A', 'Canadiens', 12, 2, 5, 7, 2),
        statRow('Yannick', 'Peccia', 'A', 'Canadiens', 1, 0, 0, 0, 0, 'playoffs'),
      ],
    },
  },
];

function main() {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

  for (const correction of corrections) {
    const aliasKeys = new Set();
    aliasKeys.add(normalizeName(correction.name.join(' ')));
    for (const alias of correction.aliases || []) {
      aliasKeys.add(normalizeName(alias.join(' ')));
    }

    for (const [season, rows] of Object.entries(fixture)) {
      fixture[season] = rows.filter((row) => {
        const full = `${row.first_name} ${row.last_name}`.trim();
        return !aliasKeys.has(normalizeName(full));
      });
    }

    for (const [season, rows] of Object.entries(correction.seasons)) {
      fixture[season] = fixture[season] || [];
      fixture[season].push(...rows);
    }
  }

  const ordered = {};
  Object.keys(fixture)
    .sort((a, b) => a.localeCompare(b, 'fr-CA', { numeric: true }))
    .forEach((season) => {
      ordered[season] = fixture[season].sort((a, b) => {
        const last = String(a.last_name).localeCompare(String(b.last_name), 'fr-CA');
        if (last !== 0) return last;
        const first = String(a.first_name).localeCompare(String(b.first_name), 'fr-CA');
        if (first !== 0) return first;
        return String(a.stat_type).localeCompare(String(b.stat_type), 'fr-CA');
      });
    });

  fs.writeFileSync(FIXTURE_PATH, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');
  console.log(`Updated ${FIXTURE_PATH}`);
}

main();

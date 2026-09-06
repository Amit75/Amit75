const RANKS = Object.freeze([
  { name: 'Bronze', minXp: 0 },
  { name: 'Silver', minXp: 500 },
  { name: 'Gold', minXp: 1500 },
  { name: 'Diamond', minXp: 3500 },
  { name: 'Aarulya Champion', minXp: 7000 }
]);

export class BattleEngine {
  constructor({ storage = window.localStorage, clock = () => Date.now() } = {}) {
    this.storage = storage;
    this.clock = clock;
    this.profileKey = 'aarulya-play-profile-v1';
    this.profile = this.#loadProfile();
    this.activeMatch = null;
  }

  #loadProfile() {
    try {
      const saved = JSON.parse(this.storage.getItem(this.profileKey) || '{}');
      return {
        playerId: saved.playerId || crypto.randomUUID(),
        displayName: saved.displayName || 'Player',
        xp: Number(saved.xp || 0),
        virtualCoins: Number(saved.virtualCoins || 2500),
        wins: Number(saved.wins || 0),
        losses: Number(saved.losses || 0),
        draws: Number(saved.draws || 0),
        completedMatches: Number(saved.completedMatches || 0),
        dailyCompleted: Number(saved.dailyCompleted || 0),
        lastDailyDate: saved.lastDailyDate || null
      };
    } catch {
      return {
        playerId: crypto.randomUUID(),
        displayName: 'Player',
        xp: 0,
        virtualCoins: 2500,
        wins: 0,
        losses: 0,
        draws: 0,
        completedMatches: 0,
        dailyCompleted: 0,
        lastDailyDate: null
      };
    }
  }

  #saveProfile() {
    this.storage.setItem(this.profileKey, JSON.stringify(this.profile));
  }

  #today() {
    return new Date(this.clock()).toISOString().slice(0, 10);
  }

  #refreshDailyState() {
    const today = this.#today();
    if (this.profile.lastDailyDate !== today) {
      this.profile.lastDailyDate = today;
      this.profile.dailyCompleted = 0;
    }
  }

  getProfile() {
    this.#refreshDailyState();
    const rank = [...RANKS].reverse().find((item) => this.profile.xp >= item.minXp) || RANKS[0];
    return { ...this.profile, rank: rank.name };
  }

  startMatch({ gameId, durationSeconds, opponentType = 'bot' }) {
    if (this.activeMatch?.status === 'active') {
      throw new Error('A match is already active.');
    }

    const now = this.clock();
    this.activeMatch = {
      matchId: crypto.randomUUID(),
      gameId,
      opponentType,
      status: 'active',
      startedAt: now,
      endsAt: now + durationSeconds * 1000,
      playerScore: 0,
      opponentScore: 0,
      events: []
    };

    return structuredClone(this.activeMatch);
  }

  addScore(points, event = 'score') {
    if (!this.activeMatch || this.activeMatch.status !== 'active') {
      throw new Error('No active match.');
    }
    const safePoints = Math.max(0, Math.floor(Number(points) || 0));
    this.activeMatch.playerScore += safePoints;
    this.activeMatch.events.push({ at: this.clock(), event, points: safePoints });
    return this.activeMatch.playerScore;
  }

  setOpponentScore(score) {
    if (!this.activeMatch || this.activeMatch.status !== 'active') {
      throw new Error('No active match.');
    }
    this.activeMatch.opponentScore = Math.max(0, Math.floor(Number(score) || 0));
  }

  finishMatch({ reason = 'completed' } = {}) {
    if (!this.activeMatch || this.activeMatch.status !== 'active') {
      throw new Error('No active match.');
    }

    const match = this.activeMatch;
    match.status = 'completed';
    match.completedAt = this.clock();
    match.reason = reason;

    const result = match.playerScore > match.opponentScore
      ? 'win'
      : match.playerScore < match.opponentScore
        ? 'loss'
        : 'draw';

    const rewards = result === 'win'
      ? { xp: 60, virtualCoins: 40 }
      : result === 'draw'
        ? { xp: 35, virtualCoins: 20 }
        : { xp: 20, virtualCoins: 10 };

    this.#refreshDailyState();
    this.profile.completedMatches += 1;
    this.profile.dailyCompleted += 1;
    this.profile.xp += rewards.xp;
    this.profile.virtualCoins += rewards.virtualCoins;
    this.profile[result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'draws'] += 1;

    let dailyMissionReward = 0;
    if (this.profile.dailyCompleted === 3) {
      dailyMissionReward = 150;
      this.profile.virtualCoins += dailyMissionReward;
    }

    this.#saveProfile();

    const receipt = {
      match: structuredClone(match),
      result,
      rewards: { ...rewards, dailyMissionReward },
      profile: this.getProfile()
    };

    this.activeMatch = null;
    return receipt;
  }
}

export { RANKS };

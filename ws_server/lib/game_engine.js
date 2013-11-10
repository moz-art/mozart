
/**
 * @param {Object} data Speed date for each group for now.
 */
function GameEngine(data) {
  this.data = data;
  this.groups = {};
}

GameEngine.prototype = {
  getGameScoreByGroup: function(groupId) {
    this._countScore(groupId);
    return this.groups[groupId].score;
  },

  // Release the groups not connected.
  cleanConnectionByGroup: function(groupId) {
    if (this.groups[groupId]) {
      delete this.groups[groupId];
    }
  },

  _countScore: function(groupId) {
    const GOOD_SPEED = 1,
          PERFECT_SCORE = 100;
    var speed = this.data[groupId],
        getScore = 0,
        speedDiff = 0;
    // Init the score for each group.
    if (!this.groups[groupId] || !this.groups[groupId].score) {
      this.groups[groupId] = {};
      this.groups[groupId].score = 0;
    }

    speedDiff = Math.abs(GOOD_SPEED - speed);
    if (speedDiff === 0) {
      getScore = PERFECT_SCORE;
    } else {
      getScore = Math.round(1 / speedDiff) ;
    }
    console.log('getScore: ' + getScore);
    this.groups[groupId].score += getScore;
  }
};

module.exports = GameEngine;

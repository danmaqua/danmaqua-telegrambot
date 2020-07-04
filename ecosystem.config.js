module.exports = {
  apps : [{
    name: 'danmaqua-bot',
    script: './bot/app.js'
  }, {
    name: 'dmsrc-bilibili',
    script: './dmsrc/bilibili/index.js'
  }, {
    name: 'dmsrc-douyu',
    script: './dmsrc/douyu/index.js'
  }]
};

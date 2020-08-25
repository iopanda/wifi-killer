var express = require('express');
var killer = require('../proc/killer');

var router = express.Router();

/* GET users listing. */
router.get('/status', function(req, res, next) {
  let job = killer.stat();
  res.send(JSON.stringify(job));
});

router.get('/start', function(req, res, next){
  let job = killer.start();
  res.send(JSON.stringify(job));
});

router.get('/stop', function(req, res, next){
  killer.stop();
  res.sendStatus(200);
});

module.exports = router;

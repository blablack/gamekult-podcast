const express = require('express');
const cron = require('node-cron');
const do_the_podcast = require('./do_the_podcast');
const app = express();

require('dotenv').config()

app.use(express.static(process.env.STORAGEPATH));
app.use(express.static('data_internal'));

const url_host = 'http://'+process.env.PODCASTHOSTNAME+':8000';

app.get('/gamekultemission', function (req, res) {
  console.log('podcast requested');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');

  feed.then(function (result) {
    res.end(result.buildXml());
  });
});

app.listen(8000, function () {
  console.log('Listening to Port 8000');
});

let feed = do_the_podcast.do_now(url_host);
cron.schedule('0 */2 * * *', () => {
  feed = do_the_podcast.do_now(url_host);
});

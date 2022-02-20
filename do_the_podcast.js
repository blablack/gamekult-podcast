const Podcast = require("podcast");
const crawl = require('./crawl');


module.exports = {
    do_now: async function (url_host) {
        const feed = podcast_header(url_host);

        const emissions_found = await crawl.crawl_gamekult_feed();
        for (var i in emissions_found) {
            const one_emission = emissions_found[i];

            feed.addItem({
                title: one_emission.title,
                description: one_emission.description,
                url: one_emission.url_article,
                enclosure: {
                    url: new URL(one_emission.file, url_host).href,
                    file: one_emission.full_filename
                },
                guid: one_emission.guid,
                date: one_emission.pub_date
            });
        }

        return feed;
    }
}

var podcast_header = function (url_host) {
    const feed = new Podcast({
        title: 'Gamekult l\'Émission',
        siteUrl: 'https://www.gamekult.com',
        author: 'Gamekult',
        imageUrl: new URL('images/emission.png', url_host).href
    });

    return feed;
}
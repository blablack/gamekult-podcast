const cheerio = require('cheerio');

const { default: axios } = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

const scdl = require('soundcloud-downloader').default
const fs = require('fs')

const path = require('path');

require('dotenv').config()

module.exports = {
    crawl_gamekult_feed: async function () {
        var all_emissions = [];
        const old_data_path = path.join(process.env.STORAGEPATH, 'emissions', 'data.json');
        var old_emissions = [];
        if (fs.existsSync(old_data_path)) {
            const old_emissions_string = fs.readFileSync(old_data_path,
                { encoding: 'utf8', flag: 'r' });
            old_emissions = JSON.parse(old_emissions_string);
            all_emissions = JSON.parse(old_emissions_string);
        }

        const agent = await login_to_gamekult();

        const xml_feed = await get_xml_feed(agent);

        const new_emissions_found = parseXML(xml_feed);

        for (var i in new_emissions_found) {
            const one_emission = new_emissions_found[i];
            var matching_emissions = all_emissions.filter(obj => {
                return obj.url_article === one_emission.url_article;
            });
            if (matching_emissions.length == 0) {
                const soundclound_url = await get_soundcloud_url(one_emission.url_article, agent);
                const file_info = download_from_soundcloud(soundclound_url);
                one_emission['file'] = file_info.filename;
                one_emission['full_filename'] = file_info.full_filename;
                one_emission['guid'] = file_info.guid; 
                all_emissions.push(one_emission);
            }
        }

        clean(all_emissions);

        if (are_arrays_different(all_emissions, old_emissions)) {
            var all_emissions_json = JSON.stringify(all_emissions);
            fs.writeFileSync(old_data_path, all_emissions_json);
        }

        return all_emissions;
    }
};

var are_arrays_different = function (all_emissions, old_emissions) {
    const found_differences_1 = all_emissions.filter((page1) => !old_emissions.find(page2 => page1.guid === page2.guid));
    const found_differences_2 = old_emissions.filter((page1) => !all_emissions.find(page2 => page1.guid === page2.guid));

    return (found_differences_1.length + found_differences_2.length) > 0;
}

var compare = function (a, b) {
    const date_a = Date.parse(a.pub_date);
    const date_b = Date.parse(b.pub_date);
    if (date_a < date_b) {
        return 1;
    }
    if (date_a > date_b) {
        return -1;
    }
    return 0;
}


var clean = function (feed_list) {
    feed_list.sort(compare);

    while (feed_list.length > 5) {
        const last = feed_list.pop();

        if (fs.existsSync(last.full_filename)) {
            fs.unlinkSync(last.full_filename);
        }
    }
}

var parseXML = function (xmlData) {
    gamekult_emissions = [];

    const parsed_feed = cheerio.load(xmlData, {
        xmlMode: true
    });

    parsed_feed('item').each(function () {
        const parsed_item = parsed_feed(this);
        const title = parsed_item.children('title').text();
        if (title.startsWith('Gamekult, l\'émission')) {
            console.log(title);
            gamekult_emissions.push({
                title: title,
                url_article: parsed_item.children('link').text(),
                description: parsed_item.children('description').text(),
                pub_date: parsed_item.children('pubDate').text()
            });
        }
    });

    return gamekult_emissions;
};

var get_xml_feed = async function (agent) {
    const url = 'https://www.gamekult.com/feed.xml';

    xml_document = await agent.get(url);

    return xml_document.data;
}

var login_to_gamekult = async function () {
    const jar = new CookieJar();
    const agent = wrapper(axios.create({ jar }));

    const login_page = await agent.get('https://www.gamekult.com/utilisateur/connexion.html')

    const page = cheerio.load(login_page.data);
    const csrf_input = page('[name=_csrf_token]');
    const csrf = csrf_input.get(0).attribs.value;

    const params = new URLSearchParams()
    params.append('username', process.env.USERNAME)
    params.append('password', process.env.PASSWORD)
    params.append('_target_path', 'https://www.gamekult.com/')
    params.append('_csrf_token', csrf)

    const config = {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:12.0) Gecko/20100101 Firefox/12.0',
            'Accept': 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Host': 'www.gamekult.com',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        }
    }

    await agent.post('https://www.gamekult.com/utilisateur/connexion.html',
        params,
        config);

    return agent;
}

var get_soundcloud_url = async function (url, agent) {
    console.log(url);

    const response = await agent.get(url);

    const page = cheerio.load(response.data);

    let found_url = ''
    page('iframe').each(function (i, e) {
        const attrs = page(this).attr();
        if (attrs.src && attrs.src.includes('api.soundcloud.com')) {
            found_url = attrs.src;
        }
    });

    console.log(found_url);

    return found_url;

};

var download_from_soundcloud = function (url) {
    // %3A      :
    // %3F      ?
    // %3D      =
    let processed_url = url.substring(url.indexOf('=') + 1);
    processed_url = processed_url.substring(0, processed_url.indexOf('&color'));
    processed_url = processed_url.replace('%3A', ':');
    processed_url = processed_url.replace('%3F', '?');
    processed_url = processed_url.replace('%3D', '=');

    const local_path = 'emissions';

    const data_path = path.join(process.env.STORAGEPATH, local_path);

    if (!fs.existsSync(data_path)) {
        fs.mkdirSync(data_path, 0744);
    }

    console.log(processed_url);

    let file_id = processed_url.substring(processed_url.indexOf('tracks/') + 7);
    file_id = file_id.substring(0, file_id.indexOf('?'));

    const full_filename = path.join(local_path, file_id + '.mp3');

    const local_full_filename = path.join(process.env.STORAGEPATH, full_filename);

    if (!fs.existsSync(local_full_filename)) {
        const CLIENT_ID = 'LBCcHmRB8XSStWL6wKH2HPACspQlXg2P'
        scdl.download(processed_url).then(stream => stream.pipe(fs.createWriteStream(local_full_filename)));
    }

    return {
        filename: full_filename,
        full_filename: path.resolve(local_full_filename),
        guid: file_id
    };
}
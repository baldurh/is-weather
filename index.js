/*****************************
 * Name:     Weather API
 * Author:   Baldur Már Helgason
 * Created:  Jan 2014
 */

/** Requires **/
var request = require('request'),
    parseString = require('xml2js').parseString,
    h = require('apis-helpers'),
    cheerio = require('cheerio'),
    xregexp = require('xregexp').XRegExp;


/** Variable initialization **/
var validTypes, measurements, stationListURL;

/* ids (tegundir textaspáa) */
validTypes = ['2','3','5','6','7','9','10','11','12','14','27','30','31','32','33','34','35','36','37','38','39','42'];
/* can later be used to include a readable version of the measurement names*/


measurements = {
  is: {
    'F'   : 'Vindhraði (m/s)',
    'FX'  : 'Mesti vindhraði (m/s)', 
    'FG'  : 'Mesta vindhviða (m/s)', 
    'D'   : 'Vindstefna', 
    'T'   : 'Hiti (°C)', 
    'W'   : 'Veðurlýsing', 
    'V'   : 'Skyggni (km)', 
    'N'   : 'Skýjahula (%)', 
    'P'   : 'Loftþrýstingur (hPa)', 
    'RH'  : 'Rakastig (%)', 
    'SNC' : 'Lýsing á snjó', 
    'SND' : 'Snjódýpt', 
    'SED' : 'Snjólag', 
    'RTE' : 'Vegahiti (°C)', 
    'TD'  : 'Daggarmark (°C)', 
    'R'   : 'Uppsöfnuð úrkoma (mm/klst) úr sjálfvirkum mælum'
  },
  en: {
    'F'   : 'Wind speed (m/s)',
    'FX'  : 'Top wind speed (m/s)',
    'FG'  : 'Top wind gust (m/s)',
    'D'   : 'Wind direction',
    'T'   : 'Air temperature (°C)',
    'W'   : 'Weather description',
    'V'   : 'Visibility (km)',
    'N'   : 'Cloud cover (%)',
    'P'   : 'Air pressure',
    'RH'  : 'Humidity (%)',
    'SNC' : 'Snow description',
    'SND' : 'Snow depth',
    'SED' : 'Snow type',
    'RTE' : 'Road temperature (°C)',
    'TD'  : 'Dew limit (°C)',
    'R'   : 'Cumulative precipitation (mm/h) from automatic measuring units'
  }
};

stationListURL = 'http://www.vedur.is/vedur/stodvar?t=3';

/** Methods **/

/* Fetches the weather data and returns a JS object in a callback */
function getJsonData(url, callback){
  request.get({
      headers: {'User-Agent': h.browser()},
      url: url
    }, function (error, response, body) {

      if (error) throw new Error(url + ' did not respond');
      
      parseString(body, function (err, result, title) {
        callback(result);
    });
  });
}

/** Exports **/

function info(callback) {
  return callback(null, {
    results: [
      {
        info: "This is an api for Icelandic weather reports and observations",
        endpoints: {
          forecasts: "/weather/forecasts/",
          observations: "/weather/observations/",
          texts: "/weather/texts/"
        },
        other: {
          availableStations: "/weather/getAvailableStations"
        }
      }
    ]
  });
}


/* Available stations handler */
function availableStations(callback) {
  request(stationListURL, function (error, response, body) {

    if (error) {
      return callback(new Error( stationListURL + ' not responding correctly...' ));
    }

    var $, idRegex, titleRegex, stations, hrefs;
    try {
      $ = cheerio.load( body );
    } catch (e) {
      return callback(new Error( 'Error loading DOM' ));
    }
    idRegex = 'station=(\\d*)'
    titleRegex = '^(([\\p{L}0-9-]*[\\s-]?)*)\\s-';
    stations = [];
    hrefs = $(".listtable td a:contains('A')");

    for (var i = 0; i < hrefs.length; i++) {

      var elem, idMatch, titleMatch;

      elem = $(hrefs[i]);

      // get the station title and id
      titleMatch = xregexp.cache(titleRegex).exec(elem.attr('title'));
      idMatch = xregexp.cache(idRegex).exec(elem.attr('href'));
      
      if (!idMatch || !titleMatch) {
        return callback(new Error( 'Parsing error -- Source is changed' ));
      }
      stations.push({name: titleMatch[1], id: idMatch[1]});
    };
    return callback(null, {results: stations});
  });
}

/* Forecasts */
function forecasts(options, callback) {
  var lang         = options.lang || 'is',
      stations     = options.stations,
      descriptions = options.descriptions,
      url          = 'http://xmlweather.vedur.is/?op_w=xml&view=xml&type=forec&lang='+lang+'&ids='+stations+'&params='+Object.keys(measurements.is).join(';');

  if (!stations) {
    return callback(new Error('No stations supplied'));
  }
  if (['is','en'].indexOf(lang) == -1) {
    return callback(new Error("Incorrect language -- only 'is' or 'en' allowed"));
  }

  getJsonData(url, function(forecasts){
    // make some nice changes to the object for cleaner JSON
    forecasts.results = forecasts.forecasts.station;
    delete forecasts.forecasts.station;
    delete forecasts.forecasts;
    h.deArrayfy(forecasts.results);
    forecasts.results.forEach(function(result){
      result.id = result.$.id;
      result.valid = result.$.valid;
      delete result.$;
      if (lang === 'is') {
        result.forecast.forEach(function(f){
          Object.keys(f).forEach(function(m){
            f[m] = f[m].replace(/,/g, '.');
          })
        })
      };
    });
    if (descriptions) {
      forecasts.descriptions = measurements[lang];
    };
    return callback(null, forecasts);
  });

}

/* Observations */
function observations(options, callback) {
  var lang         = options.lang || 'is',
      stations     = options.stations,
      descriptions = options.descriptions,
      time         = options.time,
      anytime      = options.anytime,
      url          = 'http://xmlweather.vedur.is/?op_w=xml&view=xml&type=obs&lang='+lang+'&ids='+stations+'&params='+Object.keys(measurements.is).join(';');

  if (!stations) {
    return callback(new Error('No stations supplied'));
  }
  if (['is','en'].indexOf(lang) == -1) {
    return callback(new Error("Incorrect language -- only 'is' or 'en' allowed"));
  }
  if (time) {
      url += '&time=' + time;
  };
  if (anytime) {
      url += '&anytime=' + anytime;
  };

  getJsonData(url, function(observations){
    // make some nice changes to the object for cleaner JSON
    observations.results = observations.observations.station;
    delete observations.observations.station;
    delete observations.observations;
    h.deArrayfy(observations.results);
    for (var i = observations.results.length - 1; i >= 0; i--) {
      var observation = observations.results[i];
      observation.id = observation.$.id;
      observation.valid = observation.$.valid;
      delete observation.$;
      // fix decimal
      if (lang === 'is') {
        Object.keys(observation).forEach(function(m){
          observation[m] = observation[m].replace(/,/g, '.');
        })
      };
    };
    if (descriptions) {
      observations.descriptions = measurements[lang];
    };
    return callback(null, observations);
  });
};

/* Texts */
function texts(options, callback) {
  var lang     = options.lang || 'is',
      types    = options.types,
      url      = 'http://xmlweather.vedur.is/?op_w=xml&view=xml&type=txt&lang='+lang+'&ids='+types,
      syntax   = '/weather/texts[/(is|en)]?types=<type1(,|;)...>',
      example  = '/weather/texts/is?types=5,6';

  if (!types) {
    return callback(new Error('No types supplied'));
  }
  if (['is','en'].indexOf(lang) == -1) {
    return callback(new Error("Incorrect language -- only 'is' or 'en' allowed"));
  }

  getJsonData(url, function(texts){
    // make some nice changes to the object for cleaner JSON
    texts.results = texts.texts.text;
    delete texts.texts.text;
    delete texts.texts;
    h.deArrayfy(texts.results);
    for (var i = texts.results.length - 1; i >= 0; i--) {
      var text = texts.results[i];
      text.id = text.$.id;
      delete text.$;
      if (text.content instanceof Object) {
        delete text.content.br;
        text.content = text.content._;
      };
    };
    return callback(null, texts);
  });
};

exports.availableStations = availableStations;
exports.forecasts = forecasts;
exports.observations = observations;
exports.texts = texts;

/*
* observation *
ids
http://www.vedur.is/vedur/stodvar

params (mælistærðir)
'F','FX','FG','D','T','W','V','N','P','RH','SNC','SND','SED','RTE','TD','R'

time
1h | 3h

anytime
0 | 1


* forecast *
ids
http://www.vedur.is/vedur/stodvar

params (mælistærðir)
'F','FX','FG','D','T','W','V','N','P','RH','SNC','SND','SED','RTE','TD','R'


* text *
ids (svæði)
['2','3','5','6','7','9','10','11','12','14','27','30','31','32','33','34','35','36','37','38','39','42']

*/
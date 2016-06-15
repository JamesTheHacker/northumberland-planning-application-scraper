'use strict'

let _ = require('lodash');
let cheerio = require('cheerio');
let json2csv = require('json2csv');
let moment = require('moment');
let request = require('request');

let cookieJar = request.jar();
request = request.defaults({ jar: cookieJar });

const urls = {
    search: 'https://publicaccess.northumberland.gov.uk/online-applications/search.do?action=weeklyList',
    searchPost: 'https://publicaccess.northumberland.gov.uk/online-applications/weeklyListResults.do?action=firstPage',
    searchResults: 'https://publicaccess.northumberland.gov.uk/online-applications/pagedSearchResults.do',
    summary: 'https://publicaccess.northumberland.gov.uk/online-applications/applicationDetails.do?activeTab=summary&keyVal=',
    details: 'https://publicaccess.northumberland.gov.uk/online-applications/applicationDetails.do?activeTab=details&keyVal=',
    contacts: 'https://publicaccess.northumberland.gov.uk/online-applications/applicationDetails.do?activeTab=contacts&keyVal=',
    importantDates: 'https://publicaccess.northumberland.gov.uk/online-applications/applicationDetails.do?activeTab=dates&keyVal='
}

const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.84 Safari/537.36';

/*
 * Initialize the scraper.
 */
let start = new Promise(function(resolve, reject) {
    request.get({
        headers: { 'User-Agent': ua },
        url: urls.search
    }, function(err, response, body) {
        if(err) return reject(new Error(err));
        resolve();
    });
});

/*
 * Search the website for weekly applications
 */
let search = function() {

    // If no date is passed in, get the current start of the week date.
    let startOfWeek = (process.argv[2]) ? process.argv[2] : moment().utcOffset('+0000').startOf('week').format('D MMM YYYY');

    return new Promise(function(resolve, reject) {
        request.post({
            headers: { 'User-Agent': ua, 'referer': urls.searchPost },
            uri: urls.searchPost,
            form: {
                'searchCriteria.parish': '',
                'searchCriteria.ward': '',
                'week': startOfWeek,
                'dateType': 'DC_Validated',
                'searchType': 'Application'
            }
        }, function(err, response, body) {
            if(err) return reject(err);
            resolve(body);
        });
    });
};

/*
 * Changes the search criteria to display 100 results. This can only be done AFTER the search has been done
 */
let changeSearchCriteria = function() {
    return new Promise(function(resolve, reject) {
        request.post({
            headers: { 'User-Agent': ua, 'referer': urls.searchPost, 'Upgrade-Insecure-Requests': 1 },
            uri: urls.searchResults,
            form: {
                'searchCriteria.page': 1,
                'action': 'page',
                'orderBy': 'DateReceived',
                'orderByDirection': 'Descending',
                'searchCriteria.resultsPerPage': 100
            }
        }, function(err, response, body) {
            if(err) return reject(err);
            resolve(body);
        });
    });
};

/*
 * Scrape required information from the application summary page
 */
let scrapeSummary = function(keyVal) {
    return new Promise(function(resolve, reject) {
        request.post({
            headers: { 'User-Agent': ua, 'Upgrade-Insecure-Requests': 1 },
            uri: urls.summary + keyVal,
            form: {
                'activeTab': 'summary',
                'keyVal': keyVal
            }
        }, function(err, response, body) {
            if(err) return reject(err);
            let $ = cheerio.load(body);
            
            resolve({
                reference: $('#simpleDetailsTable th:contains("Reference")').first().next().text().trim(),
                alt_reference: $('#simpleDetailsTable th:contains("Alternative Reference")').next().text().trim(),
                application_received: $('#simpleDetailsTable th:contains("Application Received")').next().text().trim(),
                application_validated: $('#simpleDetailsTable th:contains("Application Validated")').next().text().trim(),
                address: $('#simpleDetailsTable th:contains("Address")').next().text().trim(),
                proposal: $('#simpleDetailsTable th:contains("Proposal")').next().text().trim(),
                status: $('#simpleDetailsTable th:contains("Status")').first().next().text().trim(),
                appeal_status: $('#simpleDetailsTable th:contains("Appeal Status")').next().text().trim(),
                appeal_decision: $('#simpleDetailsTable th:contains("Appeal Decision")').next().text().trim()
            });
        });
    });
};

/*
 * Scrape the required information from the application details page
 */
let scrapeDetails = function(keyVal) {
    return new Promise(function(resolve, reject) {
        request.post({
            headers: { 'User-Agent': ua },
            uri: urls.details + keyVal,
            form: {
                'activeTab': 'summary',
                'keyVal': keyVal
            }
        }, function(err, response, body) {
            if(err) return reject(err);
            let $ = cheerio.load(body);

            resolve({
                application_type: $('#applicationDetails th:contains("Application Type")').next().text(),
                expected_decision_level: $('#applicationDetails th:contains("Expected Decision Level")').next().text(),
                case_officer: $('#applicationDetails th:contains("Case Officer")').next().text(),
                parish: $('#applicationDetails th:contains("Parish")').next().text(),
                ward: $('#applicationDetails th:contains("Ward")').next().text(),
                district_reference: $('#applicationDetails th:contains("District Reference")').next().text(),
                applicant_name: $('#applicationDetails th:contains("Applicant Name")').next().text(),
                applicant_address: $('#applicationDetails th:contains("Applicant Address")').next().text(),
                agent_name: $('#applicationDetails th:contains("Agent Name")').next().text(),
                agent_company_name: $('#applicationDetails th:contains("Agent Company Name")').next().text(),
                agent_address: $('#applicationDetails th:contains("Agent Address")').next().text(),
                agent_phone: $('#applicationDetails th:contains("Agent Phone Number")').next().text(),
                environmental_assessment_requested: $('#application th:contains("Environmental")').next().text()
            });
        });
    });
};


/*
 * Scrape the required information from the contacts page
 */
let scrapeContacts = function(keyVal) {
    return new Promise(function(resolve, reject) {
        request.post({
            headers: { 'User-Agent': ua },
            uri: urls.contacts + keyVal,
            form: {
                'activeTab': 'summary',
                'keyVal': keyVal
            }
        }, function(err, response, body) {
            if(err) reject(err);
            let $ = cheerio.load(body);

            resolve({
                agent_email: $('table.agents th:contains("EMAIL")').first().next().text(),
                agent_phone: $('table.agents th:contains("Phone")').first().next().text()
            });
        });
    });
}

/*
 * Run the scraper
 */
start
.then(search)
.then(changeSearchCriteria)
.then(function(body) {
    
    // Scrape the applications from the results page
    let $ = cheerio.load(body);
    let keys = [];
    $('.searchresult a').each(function() {
        let h = $(this).attr('href');
        keys.push(h.substr(h.indexOf('Val=') + 4));
    });
    return keys;
}).then(function(keys) {
    
    // Go to each application and scrape the summary, details and contact information
    let promises = keys.map(function(key, i) {        
        return Promise.all([scrapeSummary(key), scrapeDetails(key), scrapeContacts(key)]);
    });
    return Promise.all(promises);
}).then(function(results) {
   
    // Output csv to stdout
    let fields = [
        'reference',
        'alt_reference',
        'application_received',
        'application_validated',
        'address',
        'proposal',
        'status',
        'appeal_status',
        'appeal_decision',
        'application_type',
        'expected_decision_level',
        'case_officer',
        'parish',
        'ward',
        'district_reference',
        'applicant_name',
        'applicant_address',
        'agent_name',
        'agent_company_name',
        'agent_address',
        'agent_phone',
        'environmental_assesement_requested',
        'agent_email',
        'agent_phone'
    ];
    
    let data = results.map(function(res) {
        return _.extend({}, res[0], res[1], res[2]);
    });

    json2csv({ data: data, fields: fields }, function(err, csv) {
        if(err) return console.log(err);
        console.log(csv);
    });
}).catch(function(err) {
    console.error(err);
});

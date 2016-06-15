Northumberland County Council Planning Application Scraper
==========================================================

This tool will harvest data from [Northumberland County Council's online planning application](https://publicaccess.northumberland.gov.uk/online-applications/search.do?action=simple&searchType=Application) database.

It uses the [Weekly List](https://publicaccess.northumberland.gov.uk/online-applications/search.do?action=weeklyList&searchType=Application) search option to get all planning applications for a given week.

Install
-------

1. Clone the repo

    ```git clone https://github.com/JamesTheHacker/northumerland-planning-application-scraper```

2. Change into the application directory

    ```cd northumberland-planning-application-scraper```
    
3. Install the node dependencies

    ```npm install```

Usage
-----

The application outputs csv to stdout. In order to save the results pipe the output into a file.

    node scraper.js > data.csv

By default the application will get planning applications for the current week, but you can provide a custom date. Ensure the date is in `D MM YYYY` format.

    node scraper.js "19 May 2014" > data.csv

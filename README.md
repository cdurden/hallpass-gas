# hallpass-gas
This project provides Google Apps Script functions that can be used to maintain an electronic hallpass system for schools.

## How it works
Each pass is an array object, which is created by the `createPass` function. When the `onStartHallpassFormSubmit` function is triggered by a Google Forms submit event, it calls `createPass` passing it the Google Forms response object and an initial status. The pass is created and stored in a row of a private Google Sheet. Another version of the pass is stored in a separate public Google Sheet with the email address hashed so that the creator of the pass is deidentified. A Google site can then fetch the public database and check whether there is an active pass associated with the current user. If there is an active pass, its information is displayed, and the Google Form to end the pass is displayed. Otherwise the form to start the pass is displayed.

## Use
1. Import the code into a Google Apps Script project.
2. Create two Google forms, one form to start a pass, and one to end it. Make sure to "require sign-in" and restrict the form users to the domain of your users. *Note:* The `createPass` function handles how any form item responses on the start form are used when creating a pass. Currently it expects the start form to have one item.
3. Create two Google Sheet, one public and one private, to store the pass data and the partially-hashed pass data.
4. Modify the `monitoringSpreadsheetId`, `encryptedSpreadsheetId`, `startHallpassFormId`, and `endHallpassFormId` variables to point to your Google Sheets and Forms.
5. Add onSubmit triggers to the start form and the end form using the functions `onStartHallpassFormSubmit` and `onEndHallpassFormSubmit` respectively.
6. Deploy the Apps Script project, restricting its users to your domain.

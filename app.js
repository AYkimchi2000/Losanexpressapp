//load dotenv to read keys 
require('dotenv').config();

// Import required modules
const express = require('express');
const line = require('@line/bot-sdk');
const mysql = require('mysql2/promise');
const { google } = require('googleapis');
// Load the service account key from the downloaded JSON file
const credentials = require('D:/line-api-webapp/aykimchi2000-b954811e1730.json');

// Create a JWT client using the service account key
const sheetsAuth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets = google.sheets({
  version: 'v4',
  auth: sheetsAuth, // Pass the JWT client here for authentication
});

// Create an Express.js web server
const app = express();
const port = process.env.PORT || 3000;

// Define a route for the root URL
app.get('/', (req, res) => {
  res.send('Welcome to your Express.js server!');
});


// Load keys for Line API from .env
const lineConfig = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// Create a Line client
const lineClient = new line.Client(lineConfig);

// Create a database connection pool
const dbPool = mysql.createPool({
  host: 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10, // Adjust as needed
  queueLimit: 0,
});

//Set promises
app.post('/webhook', line.middleware(lineConfig), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(() => res.status(200).end())
    .catch((error) => {
      console.error('Error handling Line events:', error);
      res.status(500).send('Internal Server Error');
    });
});

// Connect to Database
dbPool.getConnection((err, connection) => {
  if (err) {
    console.error('MySQL database connection Failed:', err);
    // Handle the error as needed, e.g., exit the app or take appropriate action.
  } else {
    console.log('Connected to MySQL database');
    connection.release(); // Release the initial connection
  }
});


// Test the database connection with a simple query
async function testDatabaseConnection() {
  try {
    const connection = await dbPool.getConnection();
    const [results] = await connection.query('SELECT 1');
    console.log('Database SELECT 1 query test Success');
    connection.release();
  } catch (error) {
    console.error('Database SELECT 1 query test Failed', error);
    // Handle the error as needed.
  }
}

testDatabaseConnection();

// Line events conditions
async function handleEvent(event) {
  if (event.type === 'message' && event.message.type === 'text') {
    const instruction = event.message.text;

    if (instruction.toLowerCase() === 'hi') {
      // Handle the 'hi' instruction
      await handleHiInstruction(event);
    } else if (instruction.toLowerCase() === 'today') {
      // Handle the 'today' instruction
      await handleTodayInstruction(event);
    } else if (instruction.toLowerCase() === 'some_other_instruction') {
      // Handle another specific instruction
      await handleSomeOtherInstruction(event);
    } else {
      // Handle a default case or unknown instruction
      await handleDefaultInstruction(event);
    }
  }
}

async function handleHiInstruction(event) {
  const connection = await dbPool.getConnection();

  try {
    // Perform the database query
    const [results] = await connection.query('SELECT * FROM testtable');
    
    // Construct a response message with the data
    const responseMessage = results.map((row) => `ID: ${row.id}, Data: ${row.data}`).join('\n');

    // Reply on Line with the data
    await lineClient.replyMessage(event.replyToken, { type: 'text', text: responseMessage });
  } catch (error) {
    console.error('Database query error:', error);
  } finally {
    // Release the database connection back to the pool
    connection.release();
  }
}
// Function that handles today
async function handleTodayInstruction(event) {
  try {
    // Get the message timestamp
    const messageTimestamp = event.timestamp;

    // Convert the timestamp to a human-readable format
    const currentTime = new Date(messageTimestamp).toLocaleString();

    // Specify the spreadsheetId of the specific Google Sheet
    const spreadsheetId = '1aIoavvYdZcrdc1D6Y4dxxe3nv344f32jvyjI_4ESqHI'; // Replace with your actual spreadsheet ID
    
    // Specify the sheet name and the column where you want to add the timestamp
    const sheetName = 'Lineapitest'; // Replace with your sheet name

    // Call the function to edit the Google Sheet
    await editGoogleSheet(spreadsheetId, sheetName, currentTime);

    // Reply to Line with a success message
    await lineClient.replyMessage(event.replyToken, { type: 'text', text: `Timestamp added: ${currentTime}` });
  } catch (error) {
    console.error('Error adding timestamp to Google Sheets:', error);
    // Reply to Line with an error message
    await lineClient.replyMessage(event.replyToken, { type: 'text', text: 'An error occurred while adding the timestamp to Google Sheets.' });
  }
}




async function handleSomeOtherInstruction(event) {
  // Implement logic to handle the 'some_other_instruction'
  // You can perform database queries or other actions here
}

async function handleDefaultInstruction(event) {
  // Implement logic to handle default or unknown instructions
  // You can reply with a message indicating that the instruction is not recognized
}

// Function to edit Google Sheet with a new value
async function editGoogleSheet(spreadsheetId, sheetName, currentTime) {
  try {
    let columnIndex = 1; // Start with column A
    let updated = false; // Flag to track if an update was made

    while (true) {
      // Construct the range for the current cell in row 3
      const cell = String.fromCharCode(64 + columnIndex); // Convert index to column letter (A=1, B=2, etc.)
      const range = `${sheetName}!${cell}3`; // e.g., "Sheet1!A3"

      // Retrieve the value of the current cell
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const cellValue = response.data.values?.[0]?.[0]; // Get the cell value if it exists

      if (cellValue === undefined) {
        // The cell is undefined, update it with 'timeStamp'
        const updateResponse = await sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: 'RAW',
          resource: {
            values: [[currentTime]],
          },
        });

        console.log(`Timestamp added to ${range}: ${currentTime}`);
        
        // Set the 'updated' flag to true
        updated = true;

        // Break out of the loop
        break;
      }

      // Move to the next column
      columnIndex++;
    }

    // Check if an update was made before breaking the loop
    if (!updated) {
      console.log('No empty cells found in row 3.');
    }
  } catch (error) {
    console.error('Error editing Google Sheets:', error);
    throw error;
  }
}



// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
import fetch from 'node-fetch';
import fs from 'fs/promises';
import csvParser from 'csv-parser';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const prompt = require('prompt-sync')();


/**
Fetches real-time data from the specified URL.
@param {string} url - The URL to fetch the data from.
@returns {Promise<Object>} A promise that resolves to the fetched data. */
async function fetchRealTimeData(url) {
    try {
        console.log('Fetching data from:', url);
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching real-time data:', error);
        return null;
    }
}

/**
Reads cached data from a file.
@param {string} cacheFilePath - The path to the cache file.
@returns {Promise<Object|null>} A promise that resolves to the parsed cached data, or null if an error occurs. */ 
async function fetchAndCacheData(url, cacheFilePath) {
    const data = await fetchRealTimeData(url);
    if (data) {
        await fs.writeFile(cacheFilePath, JSON.stringify(data));
    }
}

// Function to read cached data from a file
async function readCachedData(cacheFilePath) {
    try {
        const cachedData = await fs.readFile(cacheFilePath, 'utf8');
        return JSON.parse(cachedData);
    } catch (error) {
        console.error('Error reading cached data:', error);
        return null;
    }
}

// Function to get relevant data for a specific bus route
async function getBusRouteData(selectedRoute) {
    // Read and parse routes.txt to find the route ID for the selected route
    const routesData = await readAndParseCSV('static-data/routes.txt');
    console.log('Parsed routesData:', routesData); // Debug log
    const selectedRouteData = routesData.find(route => route.route_short_name === selectedRoute);
    console.log('Selected Route Data:', selectedRouteData); // Debug log
    if (!selectedRouteData) {
        console.error('Selected route not found');
        return null;
    }

}

/**
Parses and processes the fetched data to filter the buses based on scheduled and live arrival times.
@param {Array<Object>} data - The fetched data from the API.
@returns {Array<Object>} An array of filtered bus objects.
*/
function parseAndProcessData(data, currentTime) {
    // Initialize an array to store the filtered bus data
    const filteredBuses = [];

    // Iterate through each entity in the data
    for (const entity of data) {
        console.log('Entity Data:', entity);
        if (entity.vehicle && entity.vehicle.trip) {
            const trip = entity.vehicle.trip;

        

            // Extract relevant information from the trip and vehicle data
            const routeShortName = trip.route_id;
            const routeLongName = trip.route_long_name;
            const serviceID = trip.trip_id;
            const headingSign = trip.trip_headsign;

            // Check if the scheduled arrival time is within 10 minutes from the current time
            if (scheduledArrivalTime <= currentTime + 600) {
                filteredBuses.push({
                    routeShortName,
                    routeLongName,
                    serviceID,
                    headingSign,
                    scheduledArrivalTime,
                    liveArrivalTime,
                    livePosition
                });
            }
        }
    }

    return filteredBuses;
}


// Main app function
async function main() {
    console.log('Welcome to the UQ Lakes station bus tracker!\n');

    const date = prompt('What date will you depart UQ Lakes station by bus? (YYYY-MM-DD): ');
    const time = prompt('What time will you depart UQ Lakes station by bus? (HH:mm): ');

    const busRoute = prompt('What Bus Route would you like to take? (Show All Routes, 66, 169, 209, etc): ');

    const currentDateTime = new Date(`${date}T${time}:00`).getTime() / 1000; // Convert to Unix timestamp

    const tripUpdatesURL = 'http://127.0.0.1:5343/gtfs/seq/trip_updates.json';
    const vehiclePositionsURL = 'http://127.0.0.1:5343/gtfs/seq/vehicle_positions.json';

    const tripUpdatesCacheFile = './cached-data/trip_updates.json';
    const vehiclePositionsCacheFile = './cached-data/vehicle_positions.json';

    // Fetch and cache real-time data
    await fetchAndCacheData(tripUpdatesURL, tripUpdatesCacheFile);
    await fetchAndCacheData(vehiclePositionsURL, vehiclePositionsCacheFile);

    // Read cached data
    const tripUpdatesData = await readCachedData(tripUpdatesCacheFile);
    const vehiclePositionsData = await readCachedData(vehiclePositionsCacheFile);
    

    if (!tripUpdatesData || !vehiclePositionsData) {
        console.log('Unable to fetch or read real-time data. Exiting.');
        return;
    }
// Ensure that fetched data is in array format
const tripUpdatesArray = Array.isArray(tripUpdatesData) ? tripUpdatesData : (tripUpdatesData && tripUpdatesData.entity ? tripUpdatesData.entity : []);
const vehiclePositionsArray = Array.isArray(vehiclePositionsData) ? vehiclePositionsData : (vehiclePositionsData && vehiclePositionsData.entity ? vehiclePositionsData.entity : []);

// Combine and process data
const combinedData = [...tripUpdatesArray, ...vehiclePositionsArray];
const filteredBuses  = [parseAndProcessData(combinedData, currentDateTime)];


// Wrap the filtered buses in an array
const dataWrapper = {
    buses: filteredBuses
};

console.log('Data fetched from API:');
console.table(filteredBuses);

console.log('\nThanks for using the UQ Lakes station bus tracker!');

}

/**
The main function that runs the UQ Lakes station bus tracker app.
@returns {Promise<void>} A promise that resolves when the app finishes running.
*/
main();


// debug-models.ts
try {
    console.log("Starting debug...");
    const mongoose = require('mongoose');
    console.log("Mongoose loaded.");

    // Mock alias for @/
    const path = require('path');
    const moduleAlias = require('module-alias');
    moduleAlias.addAlias('@', __dirname);

    // Try importing initModels
    console.log("Importing initModels...");
    const { initModels } = require('./lib/initModels');
    console.log("initModels imported.");

    const models = initModels();
    console.log("Models initialized:", Object.keys(models));

} catch (error) {
    console.error("CRASHED:");
    console.error(error);
}

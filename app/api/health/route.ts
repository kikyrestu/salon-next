import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

export async function GET() {
  try {
    // Check database connection
    let dbStatus = 'disconnected';
    if (mongoose.connection.readyState === 1) {
      dbStatus = 'connected';
    } else if (mongoose.connection.readyState === 2) {
      dbStatus = 'connecting';
    } else if (mongoose.connection.readyState === 3) {
      dbStatus = 'disconnecting';
    }

    // Test database connectivity by attempting a simple query
    // Simple test to check if we can perform a basic DB operation
    const testCollection = mongoose.connection.collection('test_connection');
    const dbPing = await testCollection.findOne({}).catch(() => null);

    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: dbStatus,
        ping: !!dbPing
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    return NextResponse.json(healthCheck);
  } catch (error) {
    const healthCheck = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    return NextResponse.json(healthCheck, { status: 503 });
  }
}
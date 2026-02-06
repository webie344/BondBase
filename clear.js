// Nuclear option - clears ALL IndexedDB databases and storage
async function nukeAllStorage() {
    console.log('🚀 Starting nuclear data cleanup...');
    
    // 1. Clear all localStorage for the current domain
    localStorage.clear();
    console.log('✅ localStorage cleared');
    
    // 2. Clear all sessionStorage for the current domain
    sessionStorage.clear();
    console.log('✅ sessionStorage cleared');
    
    // 3. Clear ALL IndexedDB databases
    try {
        // First, try the modern way
        if (indexedDB.databases) {
            const databases = await indexedDB.databases();
            console.log(`📊 Found ${databases.length} IndexedDB databases:`);
            
            for (const db of databases) {
                if (db.name) {
                    console.log(`🗑️ Deleting database: ${db.name} (version: ${db.version})`);
                    await new Promise((resolve, reject) => {
                        const deleteRequest = indexedDB.deleteDatabase(db.name);
                        
                        deleteRequest.onsuccess = () => {
                            console.log(`✅ Successfully deleted: ${db.name}`);
                            resolve();
                        };
                        
                        deleteRequest.onerror = (event) => {
                            console.error(`❌ Failed to delete ${db.name}:`, event.target.error);
                            reject(event.target.error);
                        };
                        
                        deleteRequest.onblocked = () => {
                            console.warn(`⚠️ Database ${db.name} is blocked. Closing all connections...`);
                            // Force close any open connections
                            setTimeout(() => {
                                indexedDB.deleteDatabase(db.name);
                                resolve();
                            }, 1000);
                        };
                    });
                }
            }
        }
    } catch (error) {
        console.log('⚠️ Could not list databases, trying fallback method...');
    }
    
    // 4. Try to delete specific databases we know about
    const knownDatabases = [
        'DatingAppDB',
        'firebase-installations-database',
        'firebase-messaging-database',
        'firestore/[DEFAULT]/usa-dating-23bc3/main',
        'firestore/[DEFAULT]/usa-dating-23bc3'
    ];
    
    for (const dbName of knownDatabases) {
        try {
            await new Promise((resolve, reject) => {
                const deleteRequest = indexedDB.deleteDatabase(dbName);
                
                deleteRequest.onsuccess = () => {
                    console.log(`✅ Deleted known database: ${dbName}`);
                    resolve();
                };
                
                deleteRequest.onerror = (event) => {
                    console.log(`ℹ️ Could not delete ${dbName} (might not exist)`);
                    resolve();
                };
                
                deleteRequest.onblocked = () => {
                    console.warn(`⚠️ ${dbName} is blocked. Will retry...`);
                    setTimeout(() => {
                        indexedDB.deleteDatabase(dbName);
                        resolve();
                    }, 500);
                };
            });
        } catch (error) {
            console.log(`⚠️ Error deleting ${dbName}:`, error.message);
        }
    }
    
    // 5. Close all open IndexedDB connections by reloading iframes
    try {
        // Close any iframes that might have IndexedDB connections
        const iframes = document.getElementsByTagName('iframe');
        for (let iframe of iframes) {
            try {
                iframe.src = 'about:blank';
                iframe.remove();
            } catch (e) {}
        }
    } catch (error) {
        console.log('⚠️ Could not clean up iframes:', error.message);
    }
    
    // 6. Clear Service Worker cache if it exists
    if ('serviceWorker' in navigator) {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
                console.log('✅ Unregistered service worker');
            }
        } catch (error) {
            console.log('⚠️ Could not unregister service workers:', error.message);
        }
    }
    
    // 7. Clear all cookies for the current domain
    const domain = window.location.hostname;
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        // Clear with domain
        document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + domain;
        // Clear without domain
        document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
    }
    console.log('✅ Cookies cleared');
    
    // 8. Force garbage collection (if available)
    if (window.gc) {
        window.gc();
        console.log('✅ Garbage collection forced');
    }
    
    console.log('🎉 NUCLEAR CLEANUP COMPLETE!');
    console.log('========================================');
    console.log('🚨 IMPORTANT NEXT STEPS:');
    console.log('1. Close ALL tabs of your app');
    console.log('2. Close your browser completely');
    console.log('3. Reopen browser and go to your app');
    console.log('4. The IndexedDB will be recreated fresh');
    console.log('========================================');
    
    alert('🚀 NUCLEAR CLEANUP COMPLETE!\n\nPlease:\n1. Close ALL tabs of this app\n2. Close your browser completely\n3. Reopen browser and go to your app\n\nThis will ensure all IndexedDB connections are closed and data is cleared.');
}

// Alternative: Delete specific database with multiple attempts
async function forceDeleteDatabase(dbName, maxAttempts = 5) {
    console.log(`🔨 Force deleting database: ${dbName}`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`Attempt ${attempt}/${maxAttempts} to delete ${dbName}`);
        
        try {
            await new Promise((resolve, reject) => {
                const deleteRequest = indexedDB.deleteDatabase(dbName);
                
                deleteRequest.onsuccess = () => {
                    console.log(`✅ Successfully deleted ${dbName} on attempt ${attempt}`);
                    resolve();
                };
                
                deleteRequest.onerror = (event) => {
                    console.error(`❌ Error on attempt ${attempt}:`, event.target.error);
                    reject(event.target.error);
                };
                
                deleteRequest.onblocked = () => {
                    console.warn(`⚠️ ${dbName} is blocked on attempt ${attempt}`);
                    // Try to close any open connections
                    setTimeout(() => {
                        indexedDB.deleteDatabase(dbName);
                        resolve();
                    }, 1000 * attempt); // Increasing delay
                };
            });
            
            return; // Success!
        } catch (error) {
            if (attempt === maxAttempts) {
                console.error(`❌ Failed to delete ${dbName} after ${maxAttempts} attempts`);
                throw error;
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

// Quick fix for your specific database
async function fixDatingAppDB() {
    console.log('🔧 Attempting to fix DatingAppDB...');
    
    try {
        // Try to open and immediately delete
        const openRequest = indexedDB.open('DatingAppDB', 1);
        
        openRequest.onerror = function(event) {
            console.error('Error opening database:', event.target.error);
        };
        
        openRequest.onupgradeneeded = function(event) {
            const db = event.target.result;
            console.log('Database upgrade needed - clearing object stores');
            
            // Delete all object stores if they exist
            const storeNames = db.objectStoreNames;
            for (let i = 0; i < storeNames.length; i++) {
                const storeName = storeNames[i];
                db.deleteObjectStore(storeName);
                console.log(`Deleted object store: ${storeName}`);
            }
        };
        
        openRequest.onsuccess = function(event) {
            const db = event.target.result;
            console.log('Database opened successfully, now closing...');
            db.close();
            
            // Now delete it
            setTimeout(() => {
                const deleteRequest = indexedDB.deleteDatabase('DatingAppDB');
                deleteRequest.onsuccess = function() {
                    console.log('✅ DatingAppDB deleted successfully!');
                    alert('✅ DatingAppDB deleted! Please refresh the page.');
                };
                deleteRequest.onerror = function(event) {
                    console.error('Error deleting database:', event.target.error);
                    alert('Error deleting database. Please close all tabs and try again.');
                };
            }, 100);
        };
        
    } catch (error) {
        console.error('Error in fixDatingAppDB:', error);
    }
}

// Run the complete cleanup
nukeAllStorage();

// Or run just the specific fix
// fixDatingAppDB();


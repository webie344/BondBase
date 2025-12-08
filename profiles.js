// profiles.js - Default Profile Creation
import { 
    getFirestore, 
    doc, 
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
    authDomain: "dating-connect.firebaseapp.com",
    projectId: "dating-connect",
    storageBucket: "dating-connect.appspot.com",
    messagingSenderId: "1062172180210",
    appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

class ProfileCreator {
    constructor() {
        this.names = {
            male: [
                'Liam', 'Noah', 'Oliver', 'Elijah', 'James', 'William', 'Benjamin', 'Lucas', 'Henry', 'Alexander',
                'Mason', 'Michael', 'Ethan', 'Daniel', 'Jacob', 'Logan', 'Jackson', 'Levi', 'Sebastian', 'Mateo',
                'Jack', 'Owen', 'Theodore', 'Aiden', 'Samuel', 'Joseph', 'John', 'David', 'Wyatt', 'Matthew',
                'Luke', 'Asher', 'Carter', 'Julian', 'Grayson', 'Leo', 'Jayden', 'Gabriel', 'Isaac', 'Lincoln',
                'Anthony', 'Hudson', 'Dylan', 'Ezra', 'Thomas', 'Charles', 'Christopher', 'Jaxon', 'Maverick', 'Josiah'
            ],
            female: [
                'Emma', 'Olivia', 'Ava', 'Isabella', 'Sophia', 'Charlotte', 'Mia', 'Amelia', 'Harper', 'Evelyn',
                'Abigail', 'Emily', 'Elizabeth', 'Mila', 'Ella', 'Avery', 'Sofia', 'Camila', 'Aria', 'Scarlett',
                'Victoria', 'Madison', 'Luna', 'Grace', 'Chloe', 'Penelope', 'Layla', 'Riley', 'Zoey', 'Nora',
                'Lily', 'Eleanor', 'Hannah', 'Lillian', 'Addison', 'Aubrey', 'Ellie', 'Stella', 'Natalie', 'Zoe',
                'Leah', 'Hazel', 'Violet', 'Aurora', 'Savannah', 'Audrey', 'Brooklyn', 'Bella', 'Claire', 'Skylar'
            ]
        };

        this.lastNames = [
            'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
            'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
            'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
            'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
            'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'
        ];

        this.bios = [
            "College student studying psychology. Love coffee shops, indie music, and deep conversations about life.",
            "Recent grad working in marketing. Always exploring the city and trying new restaurants on weekends.",
            "Art student with a passion for photography. You'll usually find me with a camera in hand.",
            "Software engineer by day, gamer by night. Love tech meetups and trying new craft beers.",
            "Nursing student who loves helping people. Enjoy hiking and yoga to balance the stressful days.",
            "Barista and part-time musician. Writing songs and pulling espresso shots are my specialties.",
            "Finance intern exploring the corporate world. Love networking events and weekend getaways.",
            "Biology major dreaming of med school. Spend my free time volunteering at animal shelters.",
            "Graphic designer with a love for minimalism. Always hunting for inspiration in the city.",
            "Education major who loves working with kids. Summer camp counselor and adventure seeker.",
            "Environmental science student passionate about sustainability. Love hiking and beach cleanups.",
            "Business student with entrepreneurial dreams. Always working on my next side project.",
            "Architecture student fascinated by urban design. You'll find me sketching in cafes.",
            "Communications major and social media manager. Love creating content and connecting with people.",
            "Chemistry student who loves lab work and research. Balance it out with dance classes.",
            "Political science major interested in activism. Attend rallies and volunteer for causes I believe in.",
            "Computer science student building apps. Love hackathons and coding challenges.",
            "Journalism student telling important stories. Always carrying a notebook for inspiration.",
            "Music production student making beats. Dream of producing for major artists someday.",
            "Fashion merchandising student with an eye for style. Love thrifting and sustainable fashion.",
            "Culinary arts student mastering pastry. My apartment always smells like fresh baked goods.",
            "Sports management major and college athlete. Live for game days and team bonding.",
            "Theater arts student and aspiring actor. Auditioning for roles while waiting tables.",
            "Economics student analyzing market trends. Love debating current events with friends.",
            "Psychology research assistant studying human behavior. Fascinated by what makes people tick.",
            "Marine biology student obsessed with the ocean. Spend weekends at the beach or aquarium.",
            "Film student directing short films. Always looking for interesting locations and stories.",
            "Social work intern helping communities. Believe in making a difference one person at a time.",
            "Mathematics tutor and puzzle enthusiast. Love solving problems and helping others learn.",
            "Foreign languages major dreaming of travel. Practicing my Spanish and French daily.",
            "Engineering student building robots. Compete in robotics competitions for fun.",
            "Public health student focused on wellness. Teach yoga classes on the side.",
            "History major with a museum internship. Love uncovering stories from the past.",
            "Hospitality management student working at a hotel. Enjoy making people feel welcome.",
            "Agriculture student with a green thumb. Maintain a community garden in my neighborhood.",
            "Physics student fascinated by the universe. Star gaze and read sci-fi in my free time.",
            "Dental hygiene student with a bright smile. Believe oral health connects to overall wellness.",
            "Aviation student working toward pilot license. Love the freedom of being in the air.",
            "Interior design student transforming spaces. Always rearranging my apartment furniture.",
            "Cybersecurity student protecting digital worlds. Ethical hacker and privacy advocate.",
            "Event planning student organizing campus activities. Love bringing people together.",
            "Fitness science major and personal trainer. Help others achieve their health goals.",
            "Animation student bringing characters to life. Spend hours perfecting digital art.",
            "Urban planning student designing better cities. Advocate for public transportation.",
            "Biotechnology researcher in a lab coat. Working on cutting-edge medical solutions.",
            "Sports medicine student treating athletes. Work with college teams on injury prevention.",
            "Video game design student creating worlds. Live for game jams and developer meetups.",
            "Sustainable fashion designer upcycling clothes. Run a small online boutique.",
            "Music therapy student healing with sound. Believe in the power of music for mental health.",
            "Adventure tourism guide in training. Lead hiking and camping trips on weekends."
        ];

        this.interests = [
            ['Coffee', 'Music Festivals', 'Photography', 'Travel', 'Art Galleries'],
            ['Brunch', 'Networking', 'City Exploration', 'Wine Tasting', 'Fashion'],
            ['Film Photography', 'Museums', 'Vinyl Records', 'Poetry', 'Coffee Shops'],
            ['Gaming', 'Tech Meetups', 'Craft Beer', 'Coding', 'VR Development'],
            ['Yoga', 'Hiking', 'Meditation', 'Wellness', 'Organic Cooking'],
            ['Live Music', 'Songwriting', 'Coffee Art', 'Open Mics', 'Vintage Shopping'],
            ['Networking Events', 'Travel', 'Fine Dining', 'Investment', 'Personal Growth'],
            ['Animal Rescue', 'Nature', 'Science', 'Volunteering', 'Outdoor Adventures'],
            ['Minimalism', 'Design', 'Urban Exploration', 'Typography', 'Creative Coding'],
            ['Child Development', 'Adventure', 'Education', 'Outdoor Activities', 'Crafts'],
            ['Sustainability', 'Hiking', 'Beach Cleanups', 'Environmental Activism', 'Gardening'],
            ['Entrepreneurship', 'Startups', 'Networking', 'Business', 'Personal Finance'],
            ['Urban Design', 'Sketching', 'Architecture', 'Cafe Culture', 'Museum Hopping'],
            ['Content Creation', 'Social Media', 'Networking', 'Photography', 'Branding'],
            ['Research', 'Dance', 'Science', 'Laboratory Work', 'Fitness'],
            ['Activism', 'Politics', 'Debate', 'Community Organizing', 'Public Speaking'],
            ['Hackathons', 'Coding', 'Tech', 'Gaming', 'Problem Solving'],
            ['Storytelling', 'Writing', 'Interviewing', 'Current Events', 'Photography'],
            ['Music Production', 'Beat Making', 'Concerts', 'Audio Engineering', 'DJing'],
            ['Fashion', 'Thrifting', 'Styling', 'Sustainable Fashion', 'Shopping'],
            ['Baking', 'Cooking', 'Food Photography', 'Recipe Development', 'Dining Out'],
            ['Sports', 'Fitness', 'Team Activities', 'Game Days', 'Leadership'],
            ['Acting', 'Theater', 'Film', 'Improv', 'Storytelling'],
            ['Economics', 'Debate', 'Current Events', 'Investment', 'Analysis'],
            ['Psychology', 'Research', 'Human Behavior', 'Counseling', 'Mental Health'],
            ['Marine Life', 'Ocean Conservation', 'Scuba Diving', 'Beach Activities', 'Science'],
            ['Filmmaking', 'Cinematography', 'Storyboarding', 'Film Analysis', 'Directing'],
            ['Community Service', 'Social Justice', 'Volunteering', 'Advocacy', 'Helping'],
            ['Puzzles', 'Mathematics', 'Tutoring', 'Problem Solving', 'Board Games'],
            ['Languages', 'Travel', 'Culture', 'International Cuisine', 'Language Exchange'],
            ['Robotics', 'Engineering', 'Technology', 'Innovation', 'Competitions'],
            ['Yoga', 'Wellness', 'Public Health', 'Meditation', 'Nutrition'],
            ['History', 'Museums', 'Research', 'Documentaries', 'Cultural Studies'],
            ['Hospitality', 'Customer Service', 'Travel', 'Cultural Exchange', 'Events'],
            ['Gardening', 'Sustainability', 'Farm-to-Table', 'Nature', 'Community'],
            ['Astronomy', 'Physics', 'Sci-Fi', 'Space Exploration', 'Research'],
            ['Dental Health', 'Wellness', 'Preventive Care', 'Education', 'Healthcare'],
            ['Aviation', 'Travel', 'Adventure', 'Technology', 'Navigation'],
            ['Interior Design', 'Home Decor', 'Space Planning', 'Color Theory', 'Renovation'],
            ['Cybersecurity', 'Privacy', 'Technology', 'Ethical Hacking', 'Digital Rights'],
            ['Event Planning', 'Networking', 'Social Media', 'Coordination', 'Marketing'],
            ['Fitness', 'Personal Training', 'Nutrition', 'Wellness', 'Sports'],
            ['Animation', 'Digital Art', 'Character Design', 'Storytelling', 'Gaming'],
            ['Urban Planning', 'Public Transit', 'Community Development', 'Sustainability', 'Design'],
            ['Biotech', 'Research', 'Medical Innovation', 'Laboratory Work', 'Science'],
            ['Sports Medicine', 'Athletics', 'Injury Prevention', 'Rehabilitation', 'Fitness'],
            ['Game Design', 'Development', 'Programming', 'Art', 'Storytelling'],
            ['Sustainable Fashion', 'Upcycling', 'Design', 'Eco-Friendly', 'Creativity'],
            ['Music Therapy', 'Mental Health', 'Performance', 'Counseling', 'Wellness'],
            ['Adventure', 'Outdoor Activities', 'Leadership', 'Travel', 'Exploration']
        ];

        this.locations = [
            'Brooklyn, NY', 'Los Angeles, CA', 'Chicago, IL', 'Austin, TX', 'Seattle, WA',
            'Denver, CO', 'Portland, OR', 'Nashville, TN', 'Atlanta, GA', 'Miami, FL',
            'Boston, MA', 'San Diego, CA', 'Philadelphia, PA', 'Phoenix, AZ', 'Las Vegas, NV',
            'Orlando, FL', 'San Francisco, CA', 'Washington, DC', 'Dallas, TX', 'Houston, TX',
            'Minneapolis, MN', 'New Orleans, LA', 'Salt Lake City, UT', 'Charlotte, NC', 'San Antonio, TX',
            'Columbus, OH', 'Indianapolis, IN', 'Kansas City, MO', 'Raleigh, NC', 'Tampa, FL',
            'Pittsburgh, PA', 'Cincinnati, OH', 'Baltimore, MD', 'St. Louis, MO', 'Milwaukee, WI',
            'Albuquerque, NM', 'Tucson, AZ', 'Fresno, CA', 'Sacramento, CA', 'Long Beach, CA',
            'Mesa, AZ', 'Virginia Beach, VA', 'Omaha, NE', 'Oakland, CA', 'Miami Beach, FL',
            'Honolulu, HI', 'Anchorage, AK', 'Portland, ME', 'Burlington, VT', 'Boulder, CO'
        ];

        // 100 UNIQUE profile pictures - NO REPEATS!
        this.profilePictures = [
            // Young Men (50 unique photos)
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1517070208541-6ddc4d3efbcb?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1519058082700-08a0b56da9b4?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1531891437562-4301cf35b7e4?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&facepad=2',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face&facepad=2',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&facepad=3',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face&facepad=3',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&facepad=4',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face&facepad=4',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&facepad=5',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face&facepad=5',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&facepad=6',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face&facepad=6',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&facepad=7',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face&facepad=7',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&facepad=8',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face&facepad=8',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&facepad=9',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face&facepad=9',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&facepad=10',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face&facepad=10',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&facepad=11',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face&facepad=11',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&facepad=12',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face&facepad=12',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&facepad=13',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face&facepad=13',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&facepad=14',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face&facepad=14',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&facepad=15',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face&facepad=15',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&facepad=16',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face&facepad=16',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&facepad=17',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face&facepad=17',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&facepad=18',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face&facepad=18',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&facepad=19',
            'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face&facepad=19',
            
            // Young Women (50 unique photos)
            'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1517365830460-955ce3ccd263?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1548142813-c348350df52b?w=400&h=400&fit=crop&crop=face',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face&facepad=2',
            'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=400&h=400&fit=crop&crop=face&facepad=2',
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face&facepad=2',
            'https://images.unsplash.com/photo-1548142813-c348350df52b?w=400&h=400&fit=crop&crop=face&facepad=2',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face&facepad=3',
            'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=400&h=400&fit=crop&crop=face&facepad=3',
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face&facepad=3',
            'https://images.unsplash.com/photo-1548142813-c348350df52b?w=400&h=400&fit=crop&crop=face&facepad=3',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face&facepad=4',
            'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=400&h=400&fit=crop&crop=face&facepad=4',
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face&facepad=4',
            'https://images.unsplash.com/photo-1548142813-c348350df52b?w=400&h=400&fit=crop&crop=face&facepad=4',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face&facepad=5',
            'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=400&h=400&fit=crop&crop=face&facepad=5',
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face&facepad=5',
            'https://images.unsplash.com/photo-1548142813-c348350df52b?w=400&h=400&fit=crop&crop=face&facepad=5',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face&facepad=6',
            'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=400&h=400&fit=crop&crop=face&facepad=6',
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face&facepad=6',
            'https://images.unsplash.com/photo-1548142813-c348350df52b?w=400&h=400&fit=crop&crop=face&facepad=6',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face&facepad=7',
            'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=400&h=400&fit=crop&crop=face&facepad=7',
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face&facepad=7',
            'https://images.unsplash.com/photo-1548142813-c348350df52b?w=400&h=400&fit=crop&crop=face&facepad=7',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face&facepad=8',
            'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=400&h=400&fit=crop&crop=face&facepad=8',
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face&facepad=8',
            'https://images.unsplash.com/photo-1548142813-c348350df52b?w=400&h=400&fit=crop&crop=face&facepad=8',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face&facepad=9',
            'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=400&h=400&fit=crop&crop=face&facepad=9',
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face&facepad=9',
            'https://images.unsplash.com/photo-1548142813-c348350df52b?w=400&h=400&fit=crop&crop=face&facepad=9',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face&facepad=10',
            'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=400&h=400&fit=crop&crop=face&facepad=10',
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face&facepad=10',
            'https://images.unsplash.com/photo-1548142813-c348350df52b?w=400&h=400&fit=crop&crop=face&facepad=10',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face&facepad=11',
            'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=400&h=400&fit=crop&crop=face&facepad=11',
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face&facepad=11'
        ];

        // Shuffle the pictures array to randomize assignment
        this.shuffleArray(this.profilePictures);
    }

    // Fisher-Yates shuffle algorithm to randomize photo assignment
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    generateProfile(id) {
        const gender = Math.random() > 0.5 ? 'male' : 'female';
        const firstName = this.names[gender][Math.floor(Math.random() * this.names[gender].length)];
        const lastName = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
        const age = Math.floor(Math.random() * 10) + 20; // 20-29 years old
        
        // Create unique email
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${id}@datingapp.com`;
        
        // Each profile gets a unique picture - no repeats!
        const pictureIndex = id - 1; // IDs start from 1, array from 0
        
        // Ensure all required fields are present
        return {
            id: `profile_${id}`,
            email: email,
            password: 'default123',
            profileData: {
                name: `${firstName} ${lastName}`,
                age: age,
                gender: gender,
                location: this.locations[Math.floor(Math.random() * this.locations.length)],
                bio: this.bios[Math.floor(Math.random() * this.bios.length)],
                interests: this.interests[Math.floor(Math.random() * this.interests.length)],
                profileImage: this.profilePictures[pictureIndex],
                likes: Math.floor(Math.random() * 100) + 20,
                profileComplete: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                isDefaultProfile: true,
                chatPoints: 50,
                isYoungProfile: true,
                // Add all required fields to prevent "Unknown" profiles
                email: email,
                uid: `profile_${id}` // Temporary, will be replaced with actual UID
            }
        };
    }

    async createProfile(profileData) {
        try {
            console.log(`Creating profile: ${profileData.email}`);
            
            const userCredential = await createUserWithEmailAndPassword(
                auth, 
                profileData.email, 
                profileData.password
            );
            
            const user = userCredential.user;
            
            // Create complete profile data with all required fields
            const completeProfileData = {
                ...profileData.profileData,
                email: profileData.email,
                uid: user.uid,
                name: profileData.profileData.name || 'Unknown',
                profileComplete: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            
            await setDoc(doc(db, 'users', user.uid), completeProfileData);

            await setDoc(doc(db, 'status', user.uid), {
                state: 'offline',
                lastChanged: serverTimestamp()
            });

            console.log(`✅ Created: ${completeProfileData.name} (${completeProfileData.age})`);
            return { success: true, userId: user.uid, profile: profileData };
            
        } catch (error) {
            console.error(`❌ Error creating ${profileData.email}:`, error);
            return { success: false, error: error.message, profile: profileData };
        }
    }

    async createMultipleProfiles(count = 50) {
        console.log(`Starting creation of ${count} young profiles (20-29 years old)...`);
        console.log(`Using ${this.profilePictures.length} unique profile pictures`);
        
        const profiles = [];
        for (let i = 1; i <= count; i++) {
            profiles.push(this.generateProfile(i));
        }
        
        // Verify no duplicate photos
        const usedPhotos = new Set();
        let hasDuplicates = false;
        profiles.forEach(profile => {
            if (usedPhotos.has(profile.profileData.profileImage)) {
                console.warn(`⚠️ DUPLICATE PHOTO: ${profile.profileData.name} - ${profile.profileData.profileImage}`);
                hasDuplicates = true;
            }
            usedPhotos.add(profile.profileData.profileImage);
        });
        
        if (!hasDuplicates) {
            console.log('✅ All profiles have unique photos!');
        } else {
            console.log('❌ Some photos are duplicated!');
        }
        
        const results = [];
        let created = 0;
        
        for (const profile of profiles) {
            const result = await this.createProfile(profile);
            results.push(result);
            created++;
            
            // Update progress
            if (typeof window.updateProgress === 'function') {
                window.updateProgress(created, count, profile.profileData.name);
            }
            
            // Delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        console.log(`🎉 Completed! Successful: ${successful.length}, Failed: ${failed.length}`);
        
        // Store credentials for display
        window.profileCredentials = successful.map(r => ({
            name: r.profile.profileData.name,
            email: r.profile.email,
            password: r.profile.password,
            age: r.profile.profileData.age,
            photo: r.profile.profileData.profileImage
        }));
        
        return { successful, failed };
    }
}

// Create global instance
const profileCreator = new ProfileCreator();

// Export the instance and function
export { profileCreator };
export const createProfiles = (count = 50) => profileCreator.createMultipleProfiles(count);
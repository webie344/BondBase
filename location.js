// location.js
document.addEventListener('DOMContentLoaded', function() {
    // Countries data with flags (20 most populous countries)
    const countries = [
    { name: 'United States', code: 'US', flag: '🇺🇸' },
    { name: 'China', code: 'CN', flag: '🇨🇳' },
    { name: 'India', code: 'IN', flag: '🇮🇳' },
    { name: 'Indonesia', code: 'ID', flag: '🇮🇩' },
    { name: 'Pakistan', code: 'PK', flag: '🇵🇰' },
    { name: 'Brazil', code: 'BR', flag: '🇧🇷' },
    { name: 'Nigeria', code: 'NG', flag: '🇳🇬' },
    { name: 'Bangladesh', code: 'BD', flag: '🇧🇩' },
    { name: 'Russia', code: 'RU', flag: '🇷🇺' },
    { name: 'Mexico', code: 'MX', flag: '🇲🇽' },
    { name: 'Japan', code: 'JP', flag: '🇯🇵' },
    { name: 'Ethiopia', code: 'ET', flag: '🇪🇹' },
    { name: 'Philippines', code: 'PH', flag: '🇵🇭' },
    { name: 'Egypt', code: 'EG', flag: '🇪🇬' },
    { name: 'Vietnam', code: 'VN', flag: '🇻🇳' },
    { name: 'DR Congo', code: 'CD', flag: '🇨🇩' },
    { name: 'Turkey', code: 'TR', flag: '🇹🇷' },
    { name: 'Iran', code: 'IR', flag: '🇮🇷' },
    { name: 'Germany', code: 'DE', flag: '🇩🇪' },
    { name: 'Thailand', code: 'TH', flag: '🇹🇭' },
    // Newly Added Countries
    { name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪' },
    { name: 'United Kingdom', code: 'GB', flag: '🇬🇧' },
    { name: 'France', code: 'FR', flag: '🇫🇷' },
    { name: 'Canada', code: 'CA', flag: '🇨🇦' }
];

// States data (12 most populous states for each country)
const states = {
    US: ['California', 'Texas', 'Florida', 'New York', 'Pennsylvania', 'Illinois', 'Ohio', 'Georgia', 'North Carolina', 'Michigan', 'New Jersey', 'Virginia'],
    CN: ['Guangdong', 'Shandong', 'Henan', 'Sichuan', 'Jiangsu', 'Hebei', 'Hunan', 'Anhui', 'Hubei', 'Zhejiang', 'Guangxi', 'Yunnan'],
    IN: ['Uttar Pradesh', 'Maharashtra', 'Bihar', 'West Bengal', 'Madhya Pradesh', 'Tamil Nadu', 'Rajasthan', 'Karnataka', 'Gujarat', 'Andhra Pradesh', 'Odisha', 'Telangana'],
    ID: ['West Java', 'East Java', 'Central Java', 'North Sumatra', 'Banten', 'Jakarta', 'West Sumatra', 'South Sulawesi', 'Riau', 'Lampung', 'South Sumatra', 'Bali'],
    PK: ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad', 'Gilgit-Baltistan', 'Azad Kashmir', 'FATA'],
    BR: ['São Paulo', 'Minas Gerais', 'Rio de Janeiro', 'Bahia', 'Paraná', 'Rio Grande do Sul', 'Pernambuco', 'Ceará', 'Pará', 'Santa Catarina', 'Maranhão', 'Goiás'],
    NG: ['Lagos', 'Kano', 'Kaduna', 'Rivers', 'Oyo', 'Ogun', 'Edo', 'Delta', 'Imo', 'Plateau', 'Sokoto', 'Benue'],
    BD: ['Dhaka', 'Chittagong', 'Rajshahi', 'Khulna', 'Barisal', 'Sylhet', 'Rangpur', 'Mymensingh'],
    RU: ['Moscow', 'Moscow Oblast', 'Krasnodar Krai', 'Saint Petersburg', 'Sverdlovsk Oblast', 'Rostov Oblast', 'Republic of Bashkortostan', 'Tatarstan', 'Chelyabinsk Oblast', 'Nizhny Novgorod Oblast', 'Samara Oblast', 'Krasnoyarsk Krai'],
    MX: ['México', 'Jalisco', 'Veracruz', 'Puebla', 'Guanajuato', 'Chiapas', 'Nuevo León', 'Michoacán', 'Oaxaca', 'Chihuahua', 'Guerrero', 'Tamaulipas'],
    JP: ['Tokyo', 'Kanagawa', 'Osaka', 'Aichi', 'Saitama', 'Chiba', 'Hyogo', 'Hokkaido', 'Fukuoka', 'Shizuoka', 'Hiroshima', 'Kyoto'],
    ET: ['Oromia', 'Amhara', 'Southern Nations', 'Somali', 'Tigray', 'Afar', 'Benishangul-Gumuz', 'Gambela', 'Harari', 'Dire Dawa', 'Addis Ababa', 'Sidama'],
    PH: ['Calabarzon', 'Central Luzon', 'Metro Manila', 'Central Visayas', 'Western Visayas', 'Bicol', 'Ilocos', 'Eastern Visayas', 'Davao', 'Zamboanga Peninsula', 'Northern Mindanao', 'Caraga'],
    EG: ['Cairo', 'Giza', 'Alexandria', 'Dakahlia', 'Sharqia', 'Beheira', 'Minya', 'Qalyubia', 'Sohag', 'Asyut', 'Gharbia', 'Monufia'],
    VN: ['Ho Chi Minh City', 'Hanoi', 'Thanh Hóa', 'Nghệ An', 'Đồng Nai', 'Bình Dương', 'Hải Phòng', 'An Giang', 'Bắc Giang', 'Bắc Ninh', 'Bình Thuận', 'Cần Thơ'],
    CD: ['Kinshasa', 'Kongo Central', 'Kwango', 'Kwilu', 'Mai-Ndombe', 'Kasaï', 'Kasaï Central', 'Kasaï Oriental', 'Lomami', 'Sankuru', 'Maniema', 'Sud-Kivu'],
    TR: ['Istanbul', 'Ankara', 'İzmir', 'Bursa', 'Adana', 'Konya', 'Antalya', 'Mersin', 'Gaziantep', 'Kayseri', 'Diyarbakır', 'Samsun'],
    IR: ['Tehran', 'Isfahan', 'Fars', 'Khorasan Razavi', 'East Azerbaijan', 'Mazandaran', 'Alborz', 'Kerman', 'Gilan', 'Kermanshah', 'Qom', 'West Azerbaijan'],
    DE: ['North Rhine-Westphalia', 'Bavaria', 'Baden-Württemberg', 'Lower Saxony', 'Hesse', 'Saxony', 'Rhineland-Palatinate', 'Berlin', 'Schleswig-Holstein', 'Brandenburg', 'Saxony-Anhalt', 'Thuringia'],
    TH: ['Bangkok', 'Nakhon Ratchasima', 'Chiang Mai', 'Ubon Ratchathani', 'Khon Kaen', 'Surat Thani', 'Udon Thani', 'Songkhla', 'Nakhon Si Thammarat', 'Chonburi', 'Phitsanulok', 'Nakhon Sawan'],
    // Newly Added States/Provinces
    AE: ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al-Quwain', 'Fujairah', 'Ras Al Khaimah'],
    GB: ['England', 'Scotland', 'Wales', 'Northern Ireland'],
    FR: ['Île-de-France', 'Auvergne-Rhône-Alpes', 'Hauts-de-France', 'Provence-Alpes-Côte d\'Azur', 'Grand Est', 'Occitanie', 'Nouvelle-Aquitaine', 'Pays de la Loire', 'Brittany', 'Normandy', 'Centre-Val de Loire', 'Bourgogne-Franche-Comté'],
    CA: ['Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba', 'Saskatchewan', 'Nova Scotia', 'New Brunswick', 'Newfoundland and Labrador', 'Prince Edward Island', 'Northwest Territories', 'Yukon']
};

    // DOM elements
    const locationContainer = document.getElementById('locationContainer');
    const countryDropdown = document.getElementById('countryDropdown');
    const stateDropdown = document.getElementById('stateDropdown');
    const flagDisplay = document.getElementById('flagDisplay');
    const selectedLocation = document.getElementById('selectedLocation');
    const locationInput = document.getElementById('accountLocation');
    const locationDropdown = document.getElementById('locationDropdown');

    // Initialize dropdowns
    function initDropdowns() {
        // Populate country dropdown
        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country.code;
            option.textContent = `${country.flag} ${country.name}`;
            countryDropdown.appendChild(option);
        });

        // Country change handler
        countryDropdown.addEventListener('change', function() {
            const countryCode = this.value;
            const selectedCountry = countries.find(c => c.code === countryCode);
            
            // Clear and populate state dropdown
            stateDropdown.innerHTML = '<option value="">Select State</option>';
            
            if (countryCode && states[countryCode]) {
                states[countryCode].forEach(state => {
                    const option = document.createElement('option');
                    option.value = state;
                    option.textContent = state;
                    stateDropdown.appendChild(option);
                });
                
                // Show state dropdown
                stateDropdown.style.display = 'block';
                flagDisplay.textContent = selectedCountry.flag;
                flagDisplay.style.display = 'inline-block';
            } else {
                // Hide state dropdown if no states available
                stateDropdown.style.display = 'none';
                flagDisplay.style.display = 'none';
            }
            
            // Clear selected location if country changes
            selectedLocation.textContent = '';
            locationInput.value = '';
        });

        // State change handler
        stateDropdown.addEventListener('change', function() {
            const countryCode = countryDropdown.value;
            const state = this.value;
            
            if (countryCode && state) {
                const selectedCountry = countries.find(c => c.code === countryCode);
                const locationText = `${selectedCountry.flag} ${selectedCountry.name}, ${state}`;
                
                selectedLocation.textContent = locationText;
                locationInput.value = `${selectedCountry.name}, ${state}`;
                
                // Hide dropdowns after selection
                locationDropdown.style.display = 'none';
            }
        });

        // Toggle location dropdown
        locationContainer.addEventListener('click', function(e) {
            if (e.target === locationContainer || e.target === selectedLocation) {
                locationDropdown.style.display = 
                    locationDropdown.style.display === 'block' ? 'none' : 'block';
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!locationContainer.contains(e.target)) {
                locationDropdown.style.display = 'none';
            }
        });
    }

    // Load saved location if exists
    function loadSavedLocation() {
        if (locationInput.value) {
            const parts = locationInput.value.split(', ');
            if (parts.length === 2) {
                const countryName = parts[0].trim();
                const stateName = parts[1].trim();
                const country = countries.find(c => c.name === countryName);
                
                if (country) {
                    // Set country
                    countryDropdown.value = country.code;
                    flagDisplay.textContent = country.flag;
                    flagDisplay.style.display = 'inline-block';
                    
                    // Trigger change event to populate states
                    const event = new Event('change');
                    countryDropdown.dispatchEvent(event);
                    
                    // Set state after a small delay to allow dropdown to populate
                    setTimeout(() => {
                        stateDropdown.value = stateName;
                        selectedLocation.textContent = `${country.flag} ${country.name}, ${stateName}`;
                    }, 100);
                }
            }
        }
    }

    // Initialize everything
    initDropdowns();
    loadSavedLocation();
});
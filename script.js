function addSubject() {
    const container = document.getElementById('subjectsContainer');
    const div = document.createElement('div');
    div.className = 'subject-input';
    div.innerHTML = `
        <input type="text" placeholder="Subject name" class="subject-name" required>
        <select class="subject-priority">
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
        </select>
        <div class="time-preference">
            <label>Preferred time:</label>
            <select class="time-preference-select">
                <option value="any">Any time</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
            </select>
        </div>
        <div class="sessions-per-week">
            <label>Sessions per week:</label>
            <input type="number" class="sessions-count" min="1" max="15" value="3" required>
        </div>
        <button onclick="removeSubject(this)">Remove</button>
    `;
    container.appendChild(div);
}

function removeSubject(button) {
    button.parentElement.remove();
}

function resetForm() {
    document.getElementById('subjectsContainer').innerHTML = `
        <div class="subject-input">
            <input type="text" placeholder="Subject name" class="subject-name" required>
            <select class="subject-priority">
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
            </select>
            <div class="time-preference">
                <label>Preferred time:</label>
                <select class="time-preference-select">
                    <option value="any">Any time</option>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                </select>
            </div>
            <div class="sessions-per-week">
                <label>Sessions per week:</label>
                <input type="number" class="sessions-count" min="1" max="15" value="3" required>
            </div>
            <button onclick="removeSubject(this)">Remove</button>
        </div>
    `;
    document.getElementById('startTime').value = '08:00';
    document.getElementById('sessionDuration').value = '60';
    document.getElementById('daysPerWeek').value = '5';
    document.getElementById('breakDuration').value = '15';
    document.getElementById('timetable').querySelector('tbody').innerHTML = '';
    document.getElementById('downloadBtn').disabled = true;
}

function validateInputs() {
    const subjectInputs = document.getElementsByClassName('subject-input');
    for (let input of subjectInputs) {
        const name = input.querySelector('.subject-name').value;
        const sessions = input.querySelector('.sessions-count').value;
        if (!name || !sessions) {
            alert('Please fill in all subject fields');
            return false;
        }
    }

    const startTime = document.getElementById('startTime').value;
    const sessionDuration = document.getElementById('sessionDuration').value;
    const breakDuration = document.getElementById('breakDuration').value;

    if (!startTime || !sessionDuration || !breakDuration) {
        alert('Please fill in all settings fields');
        return false;
    }

    return true;
}

function generate() {
    if (!validateInputs()) return;

    // Collect subjects
    const subjectInputs = document.getElementsByClassName('subject-input');
    const subjects = [];
    for (let input of subjectInputs) {
        subjects.push({
            name: input.querySelector('.subject-name').value,
            priority: input.querySelector('.subject-priority').value,
            timePreference: input.querySelector('.time-preference-select').value,
            sessionsPerWeek: parseInt(input.querySelector('.sessions-count').value),
            remainingSessions: parseInt(input.querySelector('.sessions-count').value)
        });
    }

    // Sort subjects by priority
    const priorityOrder = { High: 0, Medium: 1, Low: 2 };
    subjects.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Get settings
    const startTime = document.getElementById('startTime').value;
    const sessionDuration = parseInt(document.getElementById('sessionDuration').value);
    const daysPerWeek = parseInt(document.getElementById('daysPerWeek').value);
    const breakDuration = parseInt(document.getElementById('breakDuration').value);

    // Generate time slots
    const timeSlots = generateTimeSlots(startTime, sessionDuration, breakDuration);

    // Initialize timetable
    const timetable = Array(daysPerWeek).fill().map(() => 
        Array(timeSlots.length).fill(''));

    // Distribute subjects
    distributeSubjects(subjects, timetable, timeSlots, daysPerWeek);

    displayTimetable(timetable, timeSlots, daysPerWeek);
    document.getElementById('downloadBtn').disabled = false;
}

function generateTimeSlots(startTime, sessionDuration, breakDuration) {
    const slots = [];
    let [hours, minutes] = startTime.split(':').map(Number);
    const endHour = 18;

    while (hours < endHour) {
        slots.push(formatTime(hours, minutes));
        
        minutes += sessionDuration;
        if (minutes >= 60) {
            hours += 1;
            minutes -= 60;
        }
        
        if (breakDuration > 0) {
            minutes += breakDuration;
            if (minutes >= 60) {
                hours += 1;
                minutes %= 60;
            }
        }
    }

    return slots;
}

function distributeSubjects(subjects, timetable, timeSlots, daysPerWeek) {
    // Helper function to shuffle array randomly
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Create array of all possible slots
    const allSlots = [];
    for (let day = 0; day < daysPerWeek; day++) {
        for (let slot = 0; slot < timeSlots.length; slot++) {
            allSlots.push({ day, slot });
        }
    }

    // Process subjects in priority order
    subjects.forEach(subject => {
        let sessionsPlaced = 0;
        let attempts = 0;
        const maxAttempts = 100; // Prevent infinite loops

        while (sessionsPlaced < subject.sessionsPerWeek && attempts < maxAttempts) {
            attempts++;
            
            // Get all suitable slots for this subject
            let availableSlots = allSlots.filter(({ day, slot }) => 
                isSlotSuitable(timetable, day, slot, subject, timeSlots));

            if (availableSlots.length === 0) break;

            // Shuffle available slots to introduce randomness
            availableSlots = shuffleArray(availableSlots);

            // Score each slot based on distribution criteria
            availableSlots.forEach(slot => {
                let score = 0;
                
                // Prefer spreading across different times
                const timeUsageCount = timetable.reduce((count, day) => 
                    count + (day[slot.slot] === subject.name ? 1 : 0), 0);
                score -= timeUsageCount * 2;

                // Prefer spreading across different days
                const dayUsageCount = timetable[slot.day].filter(s => s === subject.name).length;
                score -= dayUsageCount * 3;

                // Consider time preferences with some flexibility
                const hour = parseInt(timeSlots[slot.slot].split(':')[0]);
                if (subject.timePreference === 'morning' && hour < 12) score += 2;
                if (subject.timePreference === 'afternoon' && hour >= 12) score += 2;

                // Add some randomness to break ties
                score += Math.random();

                slot.score = score;
            });

            // Sort by score and take the best slot
            availableSlots.sort((a, b) => b.score - a.score);
            
            if (availableSlots.length > 0) {
                const { day, slot } = availableSlots[0];
                timetable[day][slot] = subject.name;
                sessionsPlaced++;
            }
        }
    });
}

function isSlotSuitable(timetable, day, slot, subject, timeSlots) {
    if (timetable[day][slot] !== '') return false;

    const time = timeSlots[slot];
    const hour = parseInt(time.split(':')[0]);

    // Make time preferences more flexible
    if (subject.timePreference === 'morning' && hour >= 14) return false;
    if (subject.timePreference === 'afternoon' && hour < 10) return false;

    // Prevent same subject in adjacent slots
    const prevSlot = slot > 0 ? timetable[day][slot - 1] : '';
    const nextSlot = slot < timeSlots.length - 1 ? timetable[day][slot + 1] : '';
    if (prevSlot === subject.name || nextSlot === subject.name) return false;

    // Limit sessions per day more strictly
    const sessionsInDay = timetable[day].filter(s => s === subject.name).length;
    if (sessionsInDay >= 2) return false;

    // Check if we've used this time slot too many times for this subject
    const timeSlotUsage = timetable.reduce((count, daySlots) => 
        count + (daySlots[slot] === subject.name ? 1 : 0), 0);
    if (timeSlotUsage >= 2) return false;

    return true;
}

function formatTime(hours, minutes) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function displayTimetable(timetable, timeSlots, daysPerWeek) {
    const tbody = document.querySelector('#timetable tbody');
    tbody.innerHTML = '';

    timeSlots.forEach((time, slotIndex) => {
        const row = document.createElement('tr');
        
        const timeCell = document.createElement('td');
        timeCell.textContent = time;
        row.appendChild(timeCell);

        for (let day = 0; day < daysPerWeek; day++) {
            const cell = document.createElement('td');
            cell.textContent = timetable[day][slotIndex] || '-';
            row.appendChild(cell);
        }

        tbody.appendChild(row);
    });
}

function downloadPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const timetable = document.getElementById('timetable');
        const rows = timetable.querySelectorAll('tr');

        let yPos = 20;
        doc.setFontSize(16);
        doc.text('Student Timetable', 105, yPos, { align: 'center' });
        yPos += 10;

        const startTime = document.getElementById('startTime').value;
        const sessionDuration = document.getElementById('sessionDuration').value;
        const daysPerWeek = document.getElementById('daysPerWeek').value;
        doc.text(`Start Time: ${startTime} | Session Duration: ${sessionDuration} min | Days per Week: ${daysPerWeek}`, 105, yPos, { align: 'center' });
        yPos += 10;

        const timeColWidth = 25;
        const dayColWidth = 22;
        let xPos = 10;

        doc.setFillColor(240, 240, 240);
        doc.rect(xPos, yPos - 5, timeColWidth + (dayColWidth * parseInt(daysPerWeek)), 8, 'F');

        doc.setFontSize(8);
        rows[0].querySelectorAll('th').forEach((header, index) => {
            if (header.style.display !== 'none') {
                doc.text(header.textContent, xPos + (index * dayColWidth), yPos);
                if (index === 0) xPos += timeColWidth;
            }
        });
        yPos += 8;
        xPos = 10;

        doc.setFontSize(7);
        Array.from(rows).slice(1).forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach((cell, index) => {
                if (cell.style.display !== 'none') {
                    if (index === 0) {
                        doc.text(cell.textContent, xPos, yPos);
                        xPos += timeColWidth;
                    } else {
                        doc.text(cell.textContent, xPos, yPos);
                        xPos += dayColWidth;
                    }
                }
            });
            xPos = 10;
            yPos += 7;

            if (yPos > 280) {
                doc.addPage();
                yPos = 20;
            }
        });

        doc.save('timetable.pdf');
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF. Please try again.');
    }
}

// Get references to main screens
const homeScreen = document.getElementById('home-screen');
const configScreen = document.getElementById('config-screen');
const activeTimerScreen = document.getElementById('active-timer-screen');

// Get buttons on Home Screen
const intervalTimerBtn = document.getElementById('interval-timer-btn');
const workoutPlanBtn = document.getElementById('workout-plan-btn');

// Get elements on Config Screen
const backToHomeBtn = document.getElementById('back-to-home-btn');
const intervalInputArea = document.getElementById('interval-input-area');
const workoutPlanCreatorArea = document.getElementById('workout-plan-creator-area');
const startIntervalBtn = document.getElementById('start-interval-btn');

// Workout Plan Creator elements
const segmentTypeSelect = document.getElementById('segment-type');
const workRestInputs = document.getElementById('work-rest-inputs');
const pureRestInputs = document.getElementById('pure-rest-inputs');
const segmentWorkSecondsInput = document.getElementById('segment-work-seconds');
const segmentRestSecondsInput = document.getElementById('segment-rest-seconds');
const segmentRepetitionsInput = document.getElementById('segment-repetitions');
const pureRestSecondsInput = document.getElementById('pure-rest-seconds');
const addSegmentBtn = document.getElementById('add-segment-btn');
const workoutPlanList = document.getElementById('workout-plan-list');
const clearPlanBtn = document.getElementById('clear-plan-btn');
const startPlanBtn = document.getElementById('start-plan-btn');


// Get elements on Active Timer Screen
const backFromTimerBtn = document.getElementById('back-from-timer-btn');
const workSecondsInput = document.getElementById('work-seconds'); // Still used for interval mode
const restSecondsInput = document.getElementById('rest-seconds'); // Still used for interval mode
const countdownClock = document.getElementById('countdown-clock');
const currentPhaseIndicator = document.getElementById('current-phase');
const totalProgressBar = document.getElementById('total-progress-bar'); // Overall progress bar container
const progressBarFill = document.getElementById('progress-bar-fill'); // Actual fill element
const progressText = document.getElementById('progress-text'); // Text for progress
const pauseResumeBtn = document.getElementById('pause-resume-btn');
const stopWorkoutBtn = document.getElementById('stop-workout-btn');
const currentSegmentDisplay = document.getElementById('current-segment-display'); // New element


// Get custom modal elements
const customModalOverlay = document.getElementById('custom-modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalOkBtn = document.getElementById('modal-ok-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');


// --- Timer Variables ---
let workTime = 0;
let restTime = 0;
let currentTime = 0;
let isWorkPhase = true;
let timerInterval;
let isPaused = false;
let setsCompleted = 0; // For infinite interval mode
let isIntervalMode = false; // Flag to differentiate between interval and plan modes

// --- Workout Plan Variables ---
let workoutPlan = [];
let currentSegmentIndex = 0;
let currentSegmentRepetition = 0; // For tracking repetitions within a work-rest segment
let totalWorkoutDuration = 0; // Total duration of the entire workout plan in seconds, correctly calculated
let elapsedWorkoutDuration = 0; // Tracks overall time progress in seconds

// --- Audio Context for Beeps ---
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playBeep(frequency, duration, type = 'sine', volume = 0.5) {
    if (!audioContext) return; // Ensure audio context is available
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
}

// --- Custom Modal Functions ---
let resolveModalPromise;

function showCustomModal(title, message, isConfirm = false) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalCancelBtn.classList.toggle('hidden', !isConfirm); // Show cancel button only if it's a confirm dialog
    customModalOverlay.classList.remove('hidden'); // Ensure it's not display:none
    setTimeout(() => { // Small delay to allow display property to apply before transition
        customModalOverlay.classList.add('visible'); // Trigger CSS transition
    }, 10);

    return new Promise(resolve => {
        resolveModalPromise = resolve;
    });
}

function hideCustomModal() {
    customModalOverlay.classList.remove('visible');
    // Give time for transition to complete before setting display:none
    setTimeout(() => {
        customModalOverlay.classList.add('hidden'); // Set display:none
    }, 300); // Should match CSS transition duration
}

modalOkBtn.addEventListener('click', () => {
    hideCustomModal();
    if (resolveModalPromise) {
        resolveModalPromise(true);
    }
});

modalCancelBtn.addEventListener('click', () => {
    hideCustomModal();
    if (resolveModalPromise) {
        resolveModalPromise(false);
    }
});


// --- Navigation Functions ---

function showScreen(screenToShow) {
    const allScreens = [homeScreen, configScreen, activeTimerScreen];
    allScreens.forEach(screen => {
        if (screen === screenToShow) {
            screen.classList.remove('hidden'); 
        } else {
            screen.classList.add('hidden');
        }
    });
}

function showIntervalInput() {
    intervalInputArea.classList.remove('hidden');
    workoutPlanCreatorArea.classList.add('hidden');
    showScreen(configScreen);
    resetTimerState(); // Reset ALL timer states
}

function showWorkoutPlanCreator() {
    intervalInputArea.classList.add('hidden');
    workoutPlanCreatorArea.classList.remove('hidden');
    showScreen(configScreen);
    resetTimerState(); // Reset ALL timer states
    renderWorkoutPlan(); // Render the current plan when showing the creator
    recalculateTotalWorkoutDuration(); // Ensure total duration is correct on load
    // Ensure correct inputs are shown based on default segment type
    segmentTypeSelect.dispatchEvent(new Event('change')); // Trigger change to set initial visibility
}

function resetTimerState() {
    clearInterval(timerInterval);
    isPaused = false;
    pauseResumeBtn.textContent = 'Pause';
    countdownClock.textContent = '00:00';
    currentPhaseIndicator.textContent = '';
    progressBarFill.style.width = '0%'; // Reset fill
    progressText.textContent = ''; // Reset text
    setsCompleted = 0;
    isIntervalMode = false; // Default to false
    currentSegmentIndex = 0;
    currentSegmentRepetition = 0;
    elapsedWorkoutDuration = 0;
    // totalWorkoutDuration is not reset here, only when plan is cleared
    currentSegmentDisplay.textContent = ''; // Clear current segment display
    // Do NOT clear workoutPlan array here, only via clearPlanBtn
}

// Event Listeners for Navigation
intervalTimerBtn.addEventListener('click', showIntervalInput);
workoutPlanBtn.addEventListener('click', showWorkoutPlanCreator);

backToHomeBtn.addEventListener('click', () => {
    stopWorkout(); // Ensure timer is stopped
    showScreen(homeScreen);
});

backFromTimerBtn.addEventListener('click', () => {
    stopWorkout(); // This also returns to config screen
});

// --- Workout Plan Creator Logic ---

// Toggle visibility of work/rest inputs vs pure rest inputs
segmentTypeSelect.addEventListener('change', () => {
    if (segmentTypeSelect.value === 'work-rest') {
        workRestInputs.classList.remove('hidden');
        pureRestInputs.classList.add('hidden');
    } else { // pure-rest
        workRestInputs.classList.add('hidden');
        pureRestInputs.classList.remove('hidden');
    }
});

addSegmentBtn.addEventListener('click', async () => { // Made async to await modal response
    const type = segmentTypeSelect.value;
    let segment = { type: type };

    if (type === 'work-rest') {
        const work = parseInt(segmentWorkSecondsInput.value);
        const rest = parseInt(segmentRestSecondsInput.value);
        const reps = parseInt(segmentRepetitionsInput.value);

        if (isNaN(work) || work <= 0 || isNaN(rest) || rest < 0 || isNaN(reps) || reps <= 0) {
            await showCustomModal('Invalid Input', 'Please enter valid numbers for Work, Rest, and Repetitions.');
            return;
        }
        segment.workSeconds = work;
        segment.restSeconds = rest;
        segment.repetitions = reps;
    } else { // pure-rest
        const rest = parseInt(pureRestSecondsInput.value);
        if (isNaN(rest) || rest < 0) {
            await showCustomModal('Invalid Input', 'Please enter a valid number for Rest Duration.');
            return;
        }
        segment.restSeconds = rest;
        segment.repetitions = 1; // Pure rest is always 1 repetition
    }

    workoutPlan.push(segment);
    console.log("Workout Plan after adding segment:", workoutPlan); // Log the plan
    recalculateTotalWorkoutDuration(); // Recalculate total duration after adding
    renderWorkoutPlan();
});

clearPlanBtn.addEventListener('click', async () => { // Made async to await modal response
    const confirmClear = await showCustomModal('Clear Plan?', 'Are you sure you want to clear the entire workout plan?', true);
    if (confirmClear) {
        workoutPlan = [];
        recalculateTotalWorkoutDuration(); // Recalculate total duration after clearing (will be 0)
        console.log("Workout Plan after clearing:", workoutPlan); // Log the plan
        renderWorkoutPlan();
    }
});

function renderWorkoutPlan() {
    workoutPlanList.innerHTML = ''; // Clear current list
    if (workoutPlan.length === 0) {
        workoutPlanList.innerHTML = '<li>No segments added yet.</li>';
        clearPlanBtn.classList.add('hidden');
        startPlanBtn.classList.add('hidden');
        return;
    }

    clearPlanBtn.classList.remove('hidden');
    startPlanBtn.classList.remove('hidden'); // Show start plan button if plan exists

    workoutPlan.forEach((segment, index) => {
        const listItem = document.createElement('li');
        let description = `Segment ${index + 1}: `;
        if (segment.type === 'work-rest') {
            description += `Work ${segment.workSeconds}s / Rest ${segment.restSeconds}s x ${segment.repetitions}`;
        } else {
            description += `Pure Rest ${segment.restSeconds}s`;
        }
        listItem.textContent = description;

        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'X';
        removeBtn.classList.add('remove-segment-btn');
        // Use a function wrapper to pass the index correctly
        removeBtn.onclick = () => removeSegment(index);
        listItem.appendChild(removeBtn);

        workoutPlanList.appendChild(listItem);
    });
}

function removeSegment(indexToRemove) {
    workoutPlan.splice(indexToRemove, 1);
    console.log("Workout Plan after removing segment:", workoutPlan); // Log the plan
    recalculateTotalWorkoutDuration(); // Recalculate total duration after removing
    renderWorkoutPlan();
}

/**
 * Recalculates the total duration of the workout plan,
 * accounting for skipped rest periods between segments.
 */
function recalculateTotalWorkoutDuration() {
    let calculatedDuration = 0;
    for (let i = 0; i < workoutPlan.length; i++) {
        const segment = workoutPlan[i];
        if (segment.type === 'work-rest') {
            // Add time for all work phases within this segment
            calculatedDuration += segment.workSeconds * segment.repetitions;

            // Add time for internal rests (all but the very last one for this segment)
            // If repetitions is 1, (1-1)*restSeconds is 0, correctly adds no internal rest.
            if (segment.repetitions > 1) { 
                calculatedDuration += segment.restSeconds * (segment.repetitions - 1);
            }

            // The final 'rest' of a work-rest segment is effectively skipped by runtime logic
            // because after the last repetition, it either moves to the next segment directly
            // or the workout ends. So, it should never be added to total.
            // No need to subtract here, as it was never added to begin with (due to (repetitions-1))
            // The only case to consider is if repetitions is 0, but input validation prevents that.
            // If repetitions is 1, (1-1) is 0, so no rest is added and no subtraction is needed.

        } else if (segment.type === 'pure-rest') {
            // Pure rest segments always run their full duration
            calculatedDuration += segment.restSeconds;
        }
    }
    totalWorkoutDuration = calculatedDuration;
    console.log("Recalculated totalWorkoutDuration:", totalWorkoutDuration);
    updateProgressBar(); // Update progress bar display immediately after recalculating
}


// --- Timer Logic Functions ---

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function updateProgressBar() {
    if (isIntervalMode) {
        // For interval mode, progress indicator shows sets completed
        totalProgressBar.style.display = 'none'; // Hide the bar
        progressText.textContent = `Sets Completed: ${setsCompleted}`;
    } else {
        // For workout plan mode, progress bar shows percentage of total time
        totalProgressBar.style.display = 'block'; // Show the bar
        const percentage = totalWorkoutDuration > 0 ? (elapsedWorkoutDuration / totalWorkoutDuration) * 100 : 0;
        progressBarFill.style.width = `${percentage}%`;
        progressText.textContent = `Overall Progress: ${percentage.toFixed(1)}%`;
    }
}

function updateTimerDisplay() {
    countdownClock.textContent = formatTime(currentTime);

    const currentSegment = workoutPlan[currentSegmentIndex];
    if (!isIntervalMode && currentSegment) {
        let segmentDescription = ``;
        if (currentSegment.type === 'work-rest') {
            segmentDescription = `Segment ${currentSegmentIndex + 1}: Work ${currentSegment.workSeconds}s / Rest ${currentSegment.restSeconds}s (Rep ${currentSegmentRepetition + 1} of ${currentSegment.repetitions})`;
        } else { // pure-rest
            segmentDescription = `Segment ${currentSegmentIndex + 1}: Pure Rest ${currentSegment.restSeconds}s`;
        }
        currentSegmentDisplay.textContent = segmentDescription;
    } else {
        currentSegmentDisplay.textContent = ''; // Clear for interval mode
    }


    if (isWorkPhase) {
        currentPhaseIndicator.textContent = 'WORK';
        countdownClock.style.color = '#28a745'; // Green for work
    } else {
        currentPhaseIndicator.textContent = 'REST';
        countdownClock.style.color = '#ffc107'; // Orange for rest
    }

    // Handle last 3 seconds beeps for WORK phase
    if (isWorkPhase && currentTime <= 3 && currentTime > 0) {
        playBeep(800, 0.1); // Short high-pitched beep
    } else if (currentTime === 0) {
        // Different beep for end of cycle (0 seconds)
        playBeep(400, 0.3, 'triangle'); // Longer, lower-pitched beep
    }

    updateProgressBar(); // Always update progress display
}

function nextPhase() {
    console.log(`--- nextPhase Called ---`);
    console.log(`Current State: isWorkPhase=${isWorkPhase}, currentSegmentIndex=${currentSegmentIndex}, currentSegmentRepetition=${currentSegmentRepetition}`);
    console.log(`Workout Plan Length: ${workoutPlan.length}`);
    // console.log(`Current Segment Object:`, workoutPlan[currentSegmentIndex]); // Commented out to prevent error in interval mode

    if (isIntervalMode) {
        // Interval Mode (infinite loop)
        if (isWorkPhase) {
            isWorkPhase = false;
            currentTime = restTime;
            console.log(`[Interval Mode] Transitioning to REST. New currentTime: ${currentTime}`);
        } else {
            isWorkPhase = true;
            currentTime = workTime;
            setsCompleted++;
            console.log(`[Interval Mode] Transitioning to WORK. New currentTime: ${currentTime}, Sets Completed: ${setsCompleted}`);
        }
    } else {
        // Workout Plan Mode
        const currentSegment = workoutPlan[currentSegmentIndex];
        // This check should only apply if we are NOT in interval mode
        if (!currentSegment) {
             console.log('[Plan Mode] Workout Plan Completed (segment undefined)!');
             stopWorkout();
             showCustomModal('Workout Completed!', 'Your workout plan has finished.');
             return;
        }
        console.log(`[Plan Mode] Processing Segment:`, currentSegment);

        if (isWorkPhase) {
            // Just finished a WORK phase in a 'work-rest' segment
            isWorkPhase = false; // Next phase will be rest
            currentSegmentRepetition++; // Increment repetition count for the just-completed work cycle

            const isLastRepOfCurrentSegment = (currentSegment.type === 'work-rest' && currentSegmentRepetition >= currentSegment.repetitions);
            const isNextSegmentPureRest = (currentSegmentIndex + 1 < workoutPlan.length && workoutPlan[currentSegmentIndex + 1].type === 'pure-rest');

            console.log(`[Plan Mode] Work phase finished. Last Rep of Current Segment? ${isLastRepOfCurrentSegment}. Next Segment Pure Rest? ${isNextSegmentPureRest}`);

            if (isLastRepOfCurrentSegment && isNextSegmentPureRest) {
                // Scenario 1: Last repetition of a work-rest cycle, and the very next segment is a pure-rest.
                // Skip the internal rest of the current work-rest segment and jump directly to the pure-rest segment.
                console.log(`[Plan Mode] Skipping internal rest. Moving directly to next pure-rest segment.`);
                currentSegmentIndex++; // Advance to the pure-rest segment
                currentSegmentRepetition = 0; // Reset for the *next* work-rest segment after this pure-rest
                const nextPureRestSegment = workoutPlan[currentSegmentIndex];
                currentTime = nextPureRestSegment.restSeconds;
                isWorkPhase = false; // Already transitioned to rest phase
            } else if (isLastRepOfCurrentSegment && !isNextSegmentPureRest) {
                // Scenario 2: Last repetition of a work-rest cycle, but no pure-rest segment follows immediately, or it's the last segment overall.
                // This means the current segment is truly finished.
                console.log(`[Plan Mode] Last repetition of current work-rest segment completed. Moving to next segment in plan.`);
                currentSegmentIndex++; // Move to the next segment in the plan
                currentSegmentRepetition = 0; // Reset repetition counter for the new segment

                if (currentSegmentIndex < workoutPlan.length) {
                    const nextSegment = workoutPlan[currentSegmentIndex];
                    if (nextSegment.type === 'work-rest') {
                        isWorkPhase = true; // Next will be a work phase
                        currentTime = nextSegment.workSeconds;
                    } else { // pure-rest
                        isWorkPhase = false; // Next will be a rest phase
                        currentTime = nextSegment.restSeconds;
                    }
                    console.log(`[Plan Mode] Transitioning to new segment (${nextSegment.type}). New currentTime: ${currentTime}`);
                } else {
                    // All segments completed
                    stopWorkout();
                    showCustomModal('Workout Completed!', 'Your workout plan has finished.');
                    console.log('[Plan Mode] Workout Plan Completed (last work-rest finished)!');
                    return;
                }
            } else {
                // Scenario 3: Not the last repetition of the current work-rest segment.
                // Proceed with the internal rest of the current work-rest segment.
                console.log(`[Plan Mode] More repetitions in current work-rest. Transitioning to internal REST.`);
                currentTime = currentSegment.restSeconds;
                // isWorkPhase is already false
            }
        } else {
            // Just finished a REST phase (either internal rest of work-rest, or pure-rest segment)
            console.log(`[Plan Mode] Rest phase finished.`);

            if (currentSegment.type === 'work-rest' && currentSegmentRepetition < currentSegment.repetitions) {
                // If there are more repetitions in the current work-rest segment
                isWorkPhase = true; // Transition to next work phase
                currentTime = currentSegment.workSeconds;
                console.log(`[Plan Mode] More reps in current work-rest segment. Transitioning to WORK. New currentTime: ${currentTime}`);
            } else {
                // The current segment (work-rest or pure-rest) is fully completed its repetitions/duration.
                // Move to the next segment in the overall plan.
                currentSegmentIndex++;
                currentSegmentRepetition = 0; // Reset repetition counter for the new segment
                console.log(`[Plan Mode] Current segment completed. Moving to next segment in plan. New index: ${currentSegmentIndex}`);

                if (currentSegmentIndex < workoutPlan.length) {
                    const nextSegment = workoutPlan[currentSegmentIndex];
                    if (nextSegment.type === 'work-rest') {
                        isWorkPhase = true; // Next will be a work phase
                        currentTime = nextSegment.workSeconds;
                    } else { // pure-rest
                        isWorkPhase = false; // Next will be a rest phase
                        currentTime = nextSegment.restSeconds;
                    }
                    console.log(`[Plan Mode] Transitioning to new segment (${nextSegment.type}). New currentTime: ${currentTime}`);
                } else {
                    // All segments completed
                    stopWorkout();
                    showCustomModal('Workout Completed!', 'Your workout plan has finished.');
                    console.log('[Plan Mode] Workout Plan Completed (last rest finished)!');
                    return;
                }
            }
        }
    }
    updateTimerDisplay(); // Update display immediately for the new phase
}

function runTimer() {
    if (isPaused) return;

    currentTime--; // Decrement current phase time

    // Only increment elapsedWorkoutDuration if time is still non-negative for the current phase
    if (currentTime >= 0) { 
        elapsedWorkoutDuration++;
    }

    updateTimerDisplay();

    if (currentTime < 0) {
        nextPhase();
    }
}

function startIntervalTimer() {
    workTime = parseInt(workSecondsInput.value);
    restTime = parseInt(restSecondsInput.value);

    if (isNaN(workTime) || workTime <= 0) {
        showCustomModal('Invalid Input', 'Please enter a valid work duration (greater than 0).');
        return;
    }
    if (isNaN(restTime) || restTime < 0) {
        showCustomModal('Invalid Input', 'Please enter a valid rest duration (0 or more).');
        return;
    }

    showScreen(activeTimerScreen);
    resetTimerState(); // Ensure a clean start

    isIntervalMode = true; // Set mode to interval *after* reset

    isWorkPhase = true;
    currentTime = workTime;
    setsCompleted = 0;
    elapsedWorkoutDuration = 0; // Reset for interval mode as well
    updateTimerDisplay();

    timerInterval = setInterval(runTimer, 1000);
}

function startPlanTimer() {
    if (workoutPlan.length === 0) {
        showCustomModal('No Plan', 'Please add at least one segment to your workout plan.');
        return;
    }

    showScreen(activeTimerScreen);
    resetTimerState(); // Ensure a clean start (without resetting totalWorkoutDuration)

    isIntervalMode = false; // Set mode to workout plan *after* reset

    currentSegmentIndex = 0;
    currentSegmentRepetition = 0;
    elapsedWorkoutDuration = 0; // Reset

    // Determine initial phase based on the first segment
    const firstSegment = workoutPlan[0];
    console.log(`[startPlanTimer] Starting with first segment:`, firstSegment);
    if (firstSegment.type === 'work-rest') {
        isWorkPhase = true;
        currentTime = firstSegment.workSeconds;
    } else { // pure-rest
        isWorkPhase = false;
        currentTime = firstSegment.restSeconds;
    }

    updateTimerDisplay();
    timerInterval = setInterval(runTimer, 1000);
}


function togglePauseResume() {
    isPaused = !isPaused;
    if (isPaused) {
        clearInterval(timerInterval);
        pauseResumeBtn.textContent = 'Resume';
        countdownClock.style.color = '#6c757d'; // Grey when paused
    } else {
        timerInterval = setInterval(runTimer, 1000);
        pauseResumeBtn.textContent = 'Pause';
        countdownClock.style.color = isWorkPhase ? '#28a745' : '#ffc107';
    }
}

function stopWorkout() {
    clearInterval(timerInterval);
    resetTimerState(); // Resets all timer-related variables
    showScreen(configScreen); // Return to the configuration screen
}


// --- Event Listeners for Workout Controls ---
startIntervalBtn.addEventListener('click', startIntervalTimer);
startPlanBtn.addEventListener('click', startPlanTimer); // New listener for workout plan
pauseResumeBtn.addEventListener('click', togglePauseResume);
stopWorkoutBtn.addEventListener('click', stopWorkout);

// Initial rendering of the workout plan area
renderWorkoutPlan();
// Initial setup: Ensure home screen is visible first
showScreen(homeScreen);

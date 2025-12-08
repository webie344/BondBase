// permission.js - Microphone Permission Handler for Dating App

class MicrophonePermission {
  constructor() {
    this.recordingAllowed = false;
    this.init();
  }

  async init() {
    try {
      // Check if we already have permission
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
      
      // Update our state based on current permission
      this.handlePermissionChange(permissionStatus.state);
      
      // Listen for permission changes
      permissionStatus.onchange = () => {
        this.handlePermissionChange(permissionStatus.state);
      };
      
      // Try to get microphone access proactively
      await this.requestMicrophoneAccess();
    } catch (error) {
      console.error('Microphone permission check failed:', error);
    }
  }

  handlePermissionChange(state) {
    this.recordingAllowed = state === 'granted';
    this.updateUI();
  }

  async requestMicrophoneAccess() {
    try {
      // Try to get a media stream (will prompt user if needed)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Immediately stop the stream since we just wanted permission
      stream.getTracks().forEach(track => track.stop());
      
      this.recordingAllowed = true;
      this.updateUI();
      return true;
    } catch (error) {
      console.error('Microphone access denied:', error);
      this.recordingAllowed = false;
      this.updateUI();
      return false;
    }
  }

  updateUI() {
    // Enable/disable voice note button based on permission
    const voiceNoteBtn = document.getElementById('voiceNoteBtn');
    if (voiceNoteBtn) {
      if (this.recordingAllowed) {
        voiceNoteBtn.disabled = false;
        voiceNoteBtn.title = 'Hold to record voice note';
      } else {
        voiceNoteBtn.disabled = true;
        voiceNoteBtn.title = 'Microphone access required - click to enable';
        
        // Add click handler to request permission if disabled
        voiceNoteBtn.onclick = async () => {
          const granted = await this.requestMicrophoneAccess();
          if (granted) {
            voiceNoteBtn.disabled = false;
            voiceNoteBtn.title = 'Hold to record voice note';
            voiceNoteBtn.onclick = null;
          } else {
            alert('Microphone access is required for voice notes. Please enable it in your browser settings.');
          }
        };
      }
    }
  }

  // Helper function to check permission state
  async checkPermission() {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
      return permissionStatus.state;
    } catch (error) {
      console.error('Permission check error:', error);
      return 'prompt'; // Assume we need to prompt if check fails
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize on pages that need microphone access
  if (document.getElementById('voiceNoteBtn')) {
    window.microphonePermission = new MicrophonePermission();
  }
});

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MicrophonePermission;
}
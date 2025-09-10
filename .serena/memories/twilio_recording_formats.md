# Twilio Recording Format Analysis

## Twilio Default Recording Format
**Answer: WAV is the default format, NOT MP3**

### Official Twilio Documentation
- **Default Format**: Binary WAV audio
- **Alternative Format**: MP3 (available by appending ".mp3" to RecordingUrl)
- **Access Method**: RecordingUrl returns WAV by default; append ".mp3" for MP3 format

### Project Implementation Analysis
- **CoeFont TTS Cache**: Uses WAV format explicitly (`format: 'wav'` in coefontService.js)
- **Audio Cache Directory**: `/backend/cache/audio/` contains .wav files
- **Recording Integration**: System uses Twilio's default WAV format for call recordings
- **Conference Recordings**: Enabled with `record="record-from-start"` parameter

### Key Findings
1. Twilio saves recordings in WAV format by default
2. MP3 format is available as an option but requires explicit request
3. The AI Call System project uses WAV throughout for consistency
4. CoeFont voice synthesis also generates WAV files for caching
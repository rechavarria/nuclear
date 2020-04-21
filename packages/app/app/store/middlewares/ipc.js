import { getOption } from '@nuclear/core';
import { ipcRenderer } from 'electron';
import _ from 'lodash';

import { PAUSE_PLAYBACK, START_PLAYBACK, UPDATE_VOLUME } from '../../actions/player';
import { SCAN_LOCAL_FOLDER, REMOVE_LOCAL_FOLDER, UPDATE_LOCAL_FOLDERS, SCAN_LOCAL_FOLDER_SUCCESS } from '../../actions/local';
import { ADD_QUEUE_ITEM, CLEAR_QUEUE, REMOVE_QUEUE_ITEM } from '../../actions/queue';
import { SET_BOOLEAN_OPTION } from '../../actions/settings';
import { CHANGE_CONNECTIVITY } from '../../actions/connectivity';
import { ADD_TO_DOWNLOADS, DOWNLOAD_RESUMED, DOWNLOAD_PAUSED, DOWNLOAD_FINISHED, DOWNLOAD_ERROR } from '../../actions/downloads';

const ipcConnect = () => next => {
  next({
    type: UPDATE_LOCAL_FOLDERS,
    payload: { folders: ipcRenderer.sendSync('get-localfolders') }
  });

  next({
    type: SCAN_LOCAL_FOLDER_SUCCESS,
    payload: ipcRenderer.sendSync('get-metas')
  });

  return ({ meta = {}, payload, type }) => {
    if (meta.fromMain) {
      next({ type, payload });
      return;
    }
  
    switch (type) {
    case START_PLAYBACK:
      ipcRenderer.send('play');
      break;
    case UPDATE_VOLUME:
      ipcRenderer.send('volume', payload);
      break;
    case PAUSE_PLAYBACK:
      ipcRenderer.send('paused');
      break;
    
    case SCAN_LOCAL_FOLDER:
      ipcRenderer.send('refresh-localfolders');
      break;
    case REMOVE_LOCAL_FOLDER:
      ipcRenderer.send('remove-localfolder', payload);
      break;
    case UPDATE_LOCAL_FOLDERS:
      ipcRenderer.send('set-localfolders', payload.folders);
      break;
  
    case ADD_QUEUE_ITEM:
      ipcRenderer.send('addTrack', payload.item);
      break;
    case CLEAR_QUEUE:
      ipcRenderer.send('clear-tracklist');
      break;
    case REMOVE_QUEUE_ITEM:
      ipcRenderer.send('removeTrack', payload);
      break;
  
    case SET_BOOLEAN_OPTION:
      switch (payload.option) {
      case 'shuffleQueue':
        ipcRenderer.send('shuffle', payload.state);
        break;
      case 'loopAfterQueueEnd':
        ipcRenderer.send('loopStatus', payload.state);
        break;
      }
      break;
      
    case CHANGE_CONNECTIVITY:
      ipcRenderer.send('connectivity', payload);
      break;

    case ADD_TO_DOWNLOADS:
    case DOWNLOAD_RESUMED: {
      const {track} =_.find(payload.downloads, (item) => item.track.uuid === payload.track);

      let maxDownloads;
      try {
        maxDownloads=parseInt(getOption('max.downloads'));
      } catch (err){
        maxDownloads=1;
      }
      if (payload.downloads.filter(({status}) => status==='Started' || status === 'Waiting').length > maxDownloads) {
        break;
      }
      ipcRenderer.send('start-download', track);
      break;
    }
    case DOWNLOAD_PAUSED: {
      const {track} =_.find(payload.downloads, (item) => item.track.uuid === payload.track);

      ipcRenderer.send('pause-download', track);
      break;
    }
    case DOWNLOAD_FINISHED:
    case DOWNLOAD_ERROR: {
      const nextDownload = payload.find((download) =>
        download.status==='Waiting'
      );
      nextDownload ? ipcRenderer.send('start-download', nextDownload.track) : null;
      break;
    }
    }
  
    next({ type, payload });
  };
};

export default ipcConnect;

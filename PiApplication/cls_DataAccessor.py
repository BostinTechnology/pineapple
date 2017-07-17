"""
Contains the required AWS Connection Utilities

#TODO: If there is no db connection, will capture the data in local file ready for transmit
    This will require some space management so that we don't overfill the card.
    If it was really clever, it would create a separate thread to handle writing of the data

Process
- Data In
- Write to file

Process 2
- Data to send?
- Connected? (if not end)
- Read record(s)
- Send record(s)
- Successful? (if not end)
- Set sent flag
- More data (if so repeat read records onwards)
- Wait a period
- return to start

For initial version, connect write to file and data in file and if no ore data, end

When writing Sensor Values, TableName='SensorValues',
            Item={
                'Device_ID': {'N': str(device)},
                'TimeStamp': {'S': str(tstamp)},
                'Sensor_ID': {'N': str(sensor)},
                'SensorAcroynm': {'S' : str(acroynm)},
                'SensorDescription' : { 'S': str(desc)},
                'MVData': { 'M' : {
                    'type': { 'S' : '1'},
                    'value': { 'S' : str(data)},
                    'units': { 'S' : units}
                    }},
                'Viewed': { 'BOOL' : False},
                },

"""

import boto3
import sys
import logging
import random
import json
from datetime import time
from datetime import datetime

import Standard_Settings as SS



class DataAccessor:
    """
    Takes the given data and writes it to the required output.
    The output location will be dependent on the chosen settings - not sure where these are stored.
    Device_ID: {'N': str(device)}, TimeStamp: {'S': str(tstamp)}, Sensor_ID': {'N': str(sensor)},
    SensorAcroynm': {'S' : str(acroynm)}, SensorDescription' : { 'S': str(desc)},

    """
    def __init__(self, device, sensor, acroynm, desc):
        self.log = logging.getLogger()
        self.log.debug("[DAcc] cls_DataAccessor initialised")
        
        #TODO: Change this to use queus https://docs.python.org/3.3/library/collections.html#collections.deque
        self.records = []
        self.device = device
        self.sensor = sensor
        self.acroynm = acroynm
        self.description = desc
        self._db_version()
        return
    
    def DataIn(self,data):
        """
        Receive the data, this is expected to be in the following format
        [type, value, units]
        Process
        - Data In
        - Write to file
        There is no response
        """
        
        #BUG: Needs to accept data structures with multiple datasets in them
        # [[x,y,z],[a,b,c]]
        if self._validate_data(data):
            self._write_data_to_file(data)
        else:
            self.log.warning("[DAcc] received data was invalid:%s" % data)
        
        return
    
    def TransmitData(self):
        """
        This routine checks for data in the file and sends it
        Ideally this is called as part of a seperate thread
        Process 2
        - Connected? (if not end)
        - Read record
        - If data, Send record
        - Successful? (if not end)
        - Set sent flag
        - More data (if so repeat read records onwards)
        - Return to start
        """
        print("Transmitting Data")
        more_data = True
        record_try_count = 0
        while more_data:
            if self._connected():
                record = self._read_record()
                if len(record) > 0:
                    status = self._send_record(record)
                    if status == True:
                        self._remove_record(record)
                        record_try_count = 0
                    else:
                        record_try_count = record_try_count + 1
                        if record_try_count > SS.RECORD_TRY_COUNT:
                            self.log.error("[DAcc] Failed to send record over %s times, record archived" % record_try_count)
                            self.log.info("[DAcc] Archived Record:%s" % record)
                            self._remove_record(record)
                        else:
                            time.sleep(record_try_count)        # Wait for a period before retrying
                else:
                    more_data = False
                    self.log.info("[DAcc} No more data records to read")
            else:
                # I'm not connected, so return
                more_data = False
                self.log.info("[DAcc] Not currently connected, so no records sent")
                return False
        return True


#-----------------------------------------------------------------------
#
#    P R I V A T E   F U N C T I O N S
#
#-----------------------------------------------------------------------

    def _db_version(self):
        """
        Request the database version to work with
        """
        print("db version check is not yet implemented")
        self.log.warning("[DAcc] db version check is not yet implemented")
        self.db_version = 0.1
        return
    
    def _validate_data(self,dataset):
        """
        Check the incoming data to check it contains valid values
        Need some link into the self.db_version
        """
        print("Data Validation is not yet implemented")
        self.log.warning("[DAcc] Data Validation is not yet implemented")
        return True
    
    def _check_disk_space(self):
        """
        Validate there is enough disk space to write to file
        
        """
        print("Check for disk space for the data file is not yet implemented")
        self.log.warning("[DAcc] Check for disk space for the data file is not yet implemented")
        return True
        
    def _update_record_file(self):
        """
        Take the self.records and write it to the file
        """
        
        #TODO: Need to add some disk management, not sure what to do though!
        
        self.log.info("[DAcc] Records File udpated")
        with open(SS.RECORDFILE_LOCATION + '/' + SS.RECORDFILE_NAME, mode='w') as f:
            json.dump(self.records, f)
        return
        
    def _write_data_to_file(self,data_to_write):
        """
        Given the data, write it to the file. If it fails, try some alternative measures
        Need to have a flag to indicate if the file is being re-synchronised
        """
        self.log.info("[DAcc] _write_data_to_file")
        self.records.append(data_to_write)
        self._update_record_file()
        return True

    def _read_record(self):
        """
        Read a record out of the record file
        Return an empty string if no record to find
        """
        record = []
        if len(self.records) > 0:
            record = self.records[0]
        self.log.debug("[DAcc] Record obtained from the records file:%s" % record)
        return record
    
    def _remove_record(self,record_to_delete):
        """
        Remove record zero from the records file
        Checks the record given matches the one it is about to remove before removing it
        After removing it from the records, updates the file on disk
        """
        
        compare = self.records[0]
        if len(compare) > 0:
            if compare == record_to_delete:
                self.records.pop(0)
                self.log.debug("[DAcc] Removed record zero from the list, record was:%s" % compare)
            else:
                self.log.warning("[DAcc] When trying to remove record, it didn't match expected so no record removed")
            self._update_record_file()
        else:
            self.log.debug("[DAcc] tried to remove record zero but self.records was empty")
        return
        
    def _connected(self):
        """
        Check if the application is connected to the RESTful interface
        Returns True or False
        """
        print("Checking for connection is not yet implemented")
        self.log.warning("[DAcc] Checking for connection is not yet implemented")
        
        return True
    
    def _send_record(self, data_in):
        """
        Send the given record from the record file
        return True / False based on the sending of the record
        {
                'Device_ID': {'N': str(self.device)},
                'TimeStamp': {'S': str(tstamp)},
                'Sensor_ID': {'N': str(self.sensor)},
                'SensorAcroynm': {'S' : str(self.acroynm)},
                'SensorDescription' : { 'S': str(self.description)},
                
                THE BELOW BIT DOES NOT HOLD TRUE WITH DOCUMENTATION
                - Need to review how to store the info.
                
                'MVData': { 'M' : 
                    {                     # Multiple sets of values require seperate records
                    'type': { 'S' : '1'},
                    'value': { 'S' : str(data)},
                    'units': { 'S' : units}
                    } 
                    },
                'Viewed': { 'BOOL' : False},
                },
                
        if data_in contains multiple datasets, send each record independently
        """
        
        #TODO: Need to add database version check and implementation
        
        for item in data_in:
            data_record = {}
            data_record['Device_ID'] = { 'N' : str(self.device)}
            data_record['Sensor_ID'] = { 'N' : str(self.sensor)}
            data_record['TimeStamp'] = { 'S' : str(item[3])}
            data_record['SensorAcroynm'] = { 'N' : str(self.acroynm)}
            data_record['SensorDescription'] = { 'N' : str(self.description)}
            mvdata = {}
            mvdata['type'] = {'S' : str(item[0])}
            mvdata['value'] = {'S' : str(item[1])}
            mvdata['units'] = {'S' : str(item[2])}
            data_record['MVData'] = { 'M' : mvdata}
            data_record['Viewed'] = { 'BOOL' : False}
            
            self.log.debug("[DAcc] Data Record to be sent:%s" % data_record)
            
            #TODO: Send the data record here
            
            #TODO: set the true / false flag accordingly
            
        print("Sending of Records is not yet implemented\n:%s" % data_in)
        self.log.warning("[DAcc] Sending of Records is not yet implemented:%s" % data_in)
        return True
    
#-----------------------------------------------------------------------
#
#    T E S T   F U N C T I O N S
#
#-----------------------------------------------------------------------

## BUG: Tets data also needs to make a data strcuture that conmsists of
#       [[x,y,z],[a,b,c]]

def GenerateTimestamp():
    now = str(datetime.now())
    print("[DAcc] Generated a timestamp %s" % now[:23])
    return now[:23]
    
def GenerateTestData():
    """
    Generate a dataset to represent the simulated input
    [type, number, units]
    """
    types = ['1','2','3','4']
    units = ['lux', 'Deg C', 'Deg F', '%', 'tag']
    dataset = [[]]
    dataset[0].append(types[random.randint(0,len(types)-1)])
    dataset[0].append(random.randint(0,100))
    dataset[0].append(units[random.randint(0,len(units)-1)])
    dataset[0].append(GenerateTimestamp())
    print("Data Being Returned:%s" % dataset)
    
    return dataset

def SetupLogging():
    """
    Setup the logging defaults
    Using the logger function to span multiple files.
    """
    print("Current logging level is \n\n   DEBUG!!!!\n\n")
    
    # Create a logger with the name of the function
    logging.config.dictConfig(dict_LoggingSetup.log_cfg)
    log = logging.getLogger()

    #BUG: This is loading the wrong values into the log file
    log.info("File Logging Started, current level is %s" % log.getEffectiveLevel)
    log.info("Screen Logging Started, current level is %s" % log.getEffectiveLevel)
    
    return

def main():
    print("Sending Data In")
    # Need to add comms handler and calib data to test with
    dacc = DataAccessor(device=1, sensor=2, acroynm="Lght1", desc="Light Sensor 1")
    for i in range(0,10):
        dacc.DataIn(GenerateTestData())
    print("\nTransmitting Data\n")
    dacc.TransmitData()

if __name__ == '__main__':
    import logging
    import logging.config
    import dict_LoggingSetup
    SetupLogging()
    
    main()

import { api, LightningElement } from 'lwc';

export default class LineItemBox extends LightningElement {
    @api itemdata;
    itemdata={}

    handleInputChange(evnet){
        const {name,value} = evnet.target;
        this.itemdata[name] = value;
    }
}
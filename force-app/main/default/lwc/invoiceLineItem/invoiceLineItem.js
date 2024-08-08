import { api, LightningElement, track, wire } from 'lwc';
import { CloseActionScreenEvent } from "lightning/actions";
import { getObjectInfo, getPicklistValues, getPicklistValuesByRecordType } from 'lightning/uiObjectInfoApi';
import INVOICE_LINE_ITEM from '@salesforce/schema/INVOICE_LINE_ITEM__c';


export default class InvoiceLineItem extends LightningElement {
    @api recordId; 
    objName= INVOICE_LINE_ITEM;
    closeAction() { 
        this.dispatchEvent(new CloseActionScreenEvent())
    } 
    @track taxPicklist =[];
    @track totalInvoiceDiscountPicklist = [];
    @track lineItemTemplate = [];
    @track boxItemsArray = [];
    @track lineItem;
    selectedTemplate='Hourly';
    sendMessageToCustomer='';
    subtotalValue=0;
    discountPicklistValue;
    isPerBoxPercentageValueAvailable
    totalHourlyItems=0;
    totalAmountItems=0;
    caltemparr=[]

    get getSelectedTemplateInputs(){
        return this.selectedTemplate === 'Hourly'?true:false
    }
    
    get discountPercentageInput(){
        return this.discountPicklistValue == 'Percentage' ? true : false
    }

    get discountAmountInput(){
        return this.discountPicklistValue == 'Amount' ? true : false 
    }

    @wire(getObjectInfo,{objectApiName:'$objName'})
    invoiceObj //data.defaultRecordTypeId

    @wire(getPicklistValuesByRecordType,{objectApiName:'$objName',recordTypeId:'$invoiceObj.data.defaultRecordTypeId'})
    allPickListOfInvoiceLineItem({data,error}){
        if(data){
            this.taxPicklist = data.picklistFieldValues.Tax__c.values.map(item=>{
                return {'label':item.label,'value':item.value}
            })
            this.totalInvoiceDiscountPicklist = data.picklistFieldValues.Line_Item_Discounts__c.values.map(item=>{
                return {'label':item.label,'value':item.value}
            })
            this.lineItemTemplate = data.picklistFieldValues.Line_Item_Template__c.values.map(item=>{
                return {'label':item.label,'value':item.value}
            })
        }
        if(error){
            console.log('---->'+JSON.stringify(error));
        }
    }

    handlePicklistChange(event){
        const {name,value} =event.target;
        if(name === 'lineItemTemplatePicklist'){
            this.selectedTemplate = value;
            console.log('---->'+this.selectedTemplate);
        }
        const temp = this.boxItemsArray;
        this.caltemparr = [];
        this.caltemparr = temp.map(item=>{
            return {...item ,type:value}
        })
        this.calcHourlyAndAmountCount(this.caltemparr)
    }

    // connected callback just to add one item already but remove this when data 
    // fetch from server if present add one property boxId to distinguish
    connectedCallback(){
        this.addMoreItem();
        console.log('---->original array'+JSON.stringify(this.boxItemsArray));
    }

    addMoreItem(){
        console.log('---->selected template'+this.selectedTemplate);
        const item = {
            boxId: Date.now(),
            SAC_HSN__c:'',
            Description__c:'',
            Discount_Amount__c:'',
            Quantity__c:'',
            Rate__c:'',
            Item_Name__c:'',
            Line_Item_Discounts__c:'',
            Per_Line_Item_Amount__c:'',
            Line_Item_Amount__c:'',
            type:this.selectedTemplate
        }
        this.boxItemsArray = [...this.boxItemsArray,item];
        //calculate total hourly items count
        this.calcHourlyAndAmountCount(this.boxItemsArray);
    }

    calcHourlyAndAmountCount(boxItemsArray){
        let hcount = 0,acount =0;
        if(boxItemsArray.length === 1){
            this.totalHourlyItems = this.selectedTemplate == 'Hourly' ? this.totalHourlyItems + 1 : 0
            this.totalAmountItems = this.selectedTemplate == 'Amount' ? this.totalAmountItems + 1 : 0

        }else{
            boxItemsArray.forEach(item=>{
                if(item.type !== null && item.type == 'Hourly' && (item.Quantity__c == ''|| item.Quantity__c == null) ){
                    hcount++;
                }else{
                    acount++;
                }
            })
            this.totalHourlyItems = hcount;
            this.totalAmountItems = acount;
        }
    }
    // this code is of remove items 
    removeLineItems(event){
        const boxId = event.target.dataset.id;
        this.boxItemsArray.length === 1 ? this.emptyAllValues() : this.removeItem(boxId); 
    }

    emptyAllValues(){
       const temp = this.boxItemsArray[0]
       const item = Object.keys(temp).map(item=>{
            if(item !== 'boxId'){
                temp[item] = null
            }
       })
       console.log('---->emptyAllValues'+JSON.stringify(temp));
       this.boxItemsArray.splice(0,1,temp);
       console.log('---->emptyboxitemarray'+JSON.stringify(this.boxItemsArray));
    }
    
    removeItem(boxId){
        let itid = this.boxItemsArray.findIndex(item=>{
            item.boxId === boxId
        })
        this.boxItemsArray.splice(itid,1);
        console.log('----> remove'+JSON.stringify(this.boxItemsArray));
        this.calcSubtotal();
    }

    /*
    SELECT Id, Name, Item_Name__c, SAC_HSN__c, Discount_Percentage__c, Rate__c, Quantity__c, Line_Item_Amount__c, Invoice__c, Description__c, Per_Line_Item_Amount__c, Discount_Amount__c, Tax__c, Line_Item_Template__c, Line_Item_Discounts__c FROM Invoice_Line_Item__c
    */
    handleInputChange(event){
        console.log('--->original array'+JSON.stringify(this.boxItemsArray));
        const {name,value} = event.target;
        const boxId = event.target.dataset.id;
        //use filter rather than mutate the actual array
        let itid = this.boxItemsArray.findIndex(it=>{
            return it.boxId == event.target.dataset.id
        })
        const item = this.boxItemsArray[itid];
        console.log('----->element found'+JSON.stringify(item));
        if(name == 'Line_Item_Discounts__c'){
            this.discountPicklistValue = value
            if(this.discountPicklistValue == 'Amount'){
                this.isPerBoxPercentageValueAvailable = false;
                if(item.Discount_Amount__c > 0){
                    let subtotal =0;
                    if(this.selectedTemplate === 'Hourly'){
                        subtotal =  this.calcHourlySubtotal(this.isPerBoxPercentageValueAvailable,item.Line_Item_Amount__c,item.Discount_Amount__c);
                        subtotal = subtotal < 0 ? 0:subtotal
                        item.Per_Line_Item_Amount__c = subtotal; 
                    }else{
                        subtotal = this.calcAmountSubtotal(this.isPerBoxPercentageValueAvailable,item.Quantity__c,item.Line_Item_Amount__c,item.Discount_Amount__c);
                        subtotal = subtotal < 0 ? 0:subtotal
                        item.Per_Line_Item_Amount__c = subtotal
                    }
                }
            }else{
                if(item.Discount_Amount__c > 0){
                    this.isPerBoxPercentageValueAvailable = true;
                    let subtotal = 0;
                    if(this.selectedTemplate === 'Hourly'){
                        subtotal =  this.calcHourlySubtotal(this.isPerBoxPercentageValueAvailable,item.Line_Item_Amount__c,item.Discount_Amount__c);
                        subtotal = subtotal < 0 ? 0:subtotal
                        item.Per_Line_Item_Amount__c = subtotal; 
                    }else{
                        subtotal = this.calcAmountSubtotal(this.isPerBoxPercentageValueAvailable,item.Quantity__c,item.Line_Item_Amount__c,item.Discount_Amount__c);
                        subtotal = subtotal < 0 ? 0:subtotal
                        item.Per_Line_Item_Amount__c = subtotal
                    }
                }
            }

            //if value is already present id Discount_Amount__c the recalculate the 
            //subtotal of per box and call the method calcSubTotal()

        }
        if(name == 'discountAmountValue'){
            this.isPerBoxPercentageValueAvailable = false
            item.Discount_Amount__c = value;
        }else if(name == 'discountPercentageValue'){
            this.isPerBoxPercentageValueAvailable = true
            item.Discount_Amount__c = value
        }else{
            item[name] = value;
        }
        let subtotal,discValue=2,price;
    
        if(this.selectedTemplate == 'Hourly'){
            // if(item.hasOwnProperty('Quantity__c')){
            //     item.Quantity__c = null;
            // }
            // if(item.hasOwnProperty('Rate__c')){
            //     item.Rate__c = null;
            // }   

            //----------------------------------
            // if(this.isPerBoxPercentageValueAvailable){
            //     subtotal =  this.isvalid(item.Line_Item_Amount__c) ? parseFloat(item.Line_Item_Amount__c) *
            //     (this.isvalid(item.Discount_Amount__c)? (1-(parseFloat(item.Discount_Amount__c)/100)) : 0) : 0
            // }else{
            //     subtotal = this.isvalid(item.Line_Item_Amount__c) ?
            //     parseFloat(item.Line_Item_Amount__c) - item.Discount_Amount__c :0 
            // }
            subtotal =  this.calcHourlySubtotal(this.isPerBoxPercentageValueAvailable,item.Line_Item_Amount__c,item.Discount_Amount__c);

            subtotal = subtotal < 0 ? 0:subtotal
            item.Per_Line_Item_Amount__c = subtotal;
                  
        }else{
            /*
                Subtotal=Quantity×Price×(1−100/Discount Percentage​)
            
            if(this.isPerBoxPercentageValueAvailable){
                subtotal =  this.isvalid(item.Quantity__c) ?
                (parseFloat(item.Quantity__c)) * (this.isvalid(item.Line_Item_Amount__c) ? parseFloat(item.Line_Item_Amount__c):0) -
                (this.isvalid(item.Discount_Amount__c)? (1-(parseFloat(item.Discount_Amount__c)/100)) : 0)
                :0
            }else{
                subtotal = this.isvalid(item.Quantity__c) ?
                (parseFloat(item.Quantity__c)) * (this.isvalid(item.Line_Item_Amount__c) ? parseFloat(item.Line_Item_Amount__c):0) - this.Discount_Amount__c : 0
            }
            */
            subtotal = this.calcAmountSubtotal(this.isPerBoxPercentageValueAvailable,item.Quantity__c,item.Line_Item_Amount__c,item.Discount_Amount__c);
            subtotal = subtotal < 0 ? 0:subtotal
            item.Per_Line_Item_Amount__c = subtotal
        }
        //calculate per box amount


        //push the box to boxitem array
        console.log('----->item'+JSON.stringify(item));
        this.boxItemsArray.splice(itid,1,item);
        console.log('--------->input values'+JSON.stringify(this.boxItemsArray));
        this.calcSubtotal();
    }
    
    //calculate for Hourly Template 
    calcHourlySubtotal(isPerBoxPercentageValueAvailable,Line_Item_Amount__c,Discount_Amount__c){
        let subtotal = 0;
        if(isPerBoxPercentageValueAvailable){
            subtotal =  this.isvalid(Line_Item_Amount__c) ? parseFloat(Line_Item_Amount__c) *
            (this.isvalid(Discount_Amount__c)? (1-(parseFloat(Discount_Amount__c)/100)) : 0) : 0
        }else{
            subtotal = this.isvalid(Line_Item_Amount__c) ?
            parseFloat(Line_Item_Amount__c) - Discount_Amount__c :0 
        }
        return subtotal;
    }

    //calculate for Amount Template
    calcAmountSubtotal(isPerBoxPercentageValueAvailable,Quantity__c,Line_Item_Amount__c,Discount_Amount__c){
        if(isPerBoxPercentageValueAvailable){
            subtotal =  this.isvalid(Quantity__c) ?
            (parseFloat(Quantity__c)) * (this.isvalid(Line_Item_Amount__c) ? parseFloat(Line_Item_Amount__c):0) -
            (this.isvalid(Discount_Amount__c)? (1-(parseFloat(Discount_Amount__c)/100)) : 0)
            :0
        }else{
            subtotal = this.isvalid(Quantity__c) ?
            (parseFloat(Quantity__c)) * (this.isvalid(Line_Item_Amount__c) ? parseFloat(Line_Item_Amount__c):0) - Discount_Amount__c : 0
        }
    }

    givePerBoxSubTotal(isPerBoxPercentageValueAvailable){

    }

    isvalid(val){
        return val == null || val === undefined || val == ' ' || val === 0 ? false : true
    }

    removeKey(itid){
        const item = this.boxItemsArray[itid];
        
    }


    //Send message to customer
    messageToCustomer(event){
        this.sendMessageToCustomer = event.target.value;
    }
    
    calcSubtotal(){
        this.subtotalValue = this.boxItemsArray.reduce(
            (accumulator, currentValue) => accumulator + currentValue.Per_Line_Item_Amount__c,
            0,
        );
        console.log('------>subtotal'+this.subtotalValue);
        
    }
}